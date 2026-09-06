// =============================================
// Edge Function: cora
// =============================================
// Ponte entre o ERP e a API de cobrança da Cora. Chamada pelo front via:
//   supabaseClient.functions.invoke('cora', { body: { acao: 'emitir', ... } })
//
// Ações: status | testar_conexao | registrar_webhook | emitir | consultar
//        cancelar | reconciliar | desconectar | eventos
//
// REGRA DURA: o `receivable_id` vem do body, mas VALOR, VENCIMENTO e CLIENTE
// vêm do banco. Um valor_centavos vindo do navegador seria emissão de boleto
// com valor arbitrário por qualquer pessoa logada.
//
// Nenhuma resposta daqui carrega token, refresh_token ou client_secret — as
// tabelas de credencial são deny-all justamente para não haver caminho de
// leitura pelo navegador.

import {
  adminClient, CORS, exigirPerfil, json, registrarLog, usuarioDoToken,
} from "../_shared/base.ts";
import {
  cancelarCobranca, conexaoAtual, configurada, consultarCobranca,
  CORA_ENV, criarCobranca, ErroCora, extrairPagamento, PROVIDER,
  reaisParaCentavos, registrarWebhook, tokenDaOrg, traduzStatus,
} from "../_shared/cora.ts";
import { BASE_ENV } from "../_shared/base.ts";

const PERFIS_FINANCEIRO = ["admin", "gestor", "financeiro"];
const so = (v: unknown) => (typeof v === "string" ? v : "");

// Monta o objeto `customer` a partir do cadastro, e recusa cedo com a lista
// NOMINAL do que falta — "endereço incompleto" faz o usuário adivinhar.
function clienteParaCora(c: Record<string, unknown> | null) {
  const faltando: string[] = [];
  if (!c) return { faltando: ["cliente"], cliente: null };

  const doc = so(c.cnpj) || so(c.cpf);
  const digitos = doc.replace(/\D/g, "");
  if (!digitos) faltando.push("CPF ou CNPJ");
  else if (digitos.length !== 11 && digitos.length !== 14) {
    faltando.push("CPF ou CNPJ com número válido");
  }

  const nome = so(c.razao_social) || so(c.name);
  if (!nome) faltando.push("nome / razão social");

  const campos: Array<[string, string]> = [
    ["logradouro", "logradouro"], ["numero", "número"], ["bairro", "bairro"],
    ["municipio", "município"], ["uf", "UF"], ["cep", "CEP"],
  ];
  for (const [k, rotulo] of campos) if (!so(c[k])) faltando.push(rotulo);

  if (faltando.length) return { faltando, cliente: null };

  return {
    faltando: [],
    cliente: {
      name: nome,
      email: so(c.email) || undefined,
      document: {
        identity: digitos,
        type: (digitos.length === 14 ? "CNPJ" : "CPF") as "CNPJ" | "CPF",
      },
      address: {
        street: so(c.logradouro),
        number: so(c.numero),
        district: so(c.bairro),
        city: so(c.municipio),
        state: so(c.uf).toUpperCase(),
        complement: so(c.complemento) || undefined,
        zip_code: so(c.cep).replace(/\D/g, ""),
      },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const userId = await usuarioDoToken(req);
  if (!userId) return json({ error: "unauthorized" }, 401);

  const { ok, role } = await exigirPerfil(userId, PERFIS_FINANCEIRO);
  if (!ok) return json({ error: "sem_permissao" }, 403);

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const acao = so(body.acao);
  const db = adminClient();
  const ambiente = CORA_ENV.AMBIENTE;

  try {
    switch (acao) {
      // ── Diagnóstico. Não devolve NENHUM segredo. ──
      case "status": {
        const cx = await conexaoAtual();
        const { count: pendentes } = await db.from("payment_charges")
          .select("id", { count: "exact", head: true })
          .in("status", ["aberta", "em_pagamento", "vencida"]);
        return json({
          configurada: configurada(),
          conectado: !!cx && cx.status === "conectado",
          status: cx?.status ?? "nao_configurado",
          ambiente,
          conta_nome: cx?.conta_nome ?? null,
          conta_documento: cx?.conta_documento ?? null,
          escopo: cx?.scope ?? null,
          conectado_em: cx?.conectado_em ?? null,
          ultimo_refresh_em: cx?.ultimo_refresh_em ?? null,
          // A sessão da Cora morre com 60 dias de inatividade. A tela precisa
          // avisar ANTES de quebrar, não na hora de emitir um boleto.
          dias_desde_refresh: cx?.ultimo_refresh_em
            ? Math.floor(
              (Date.now() - new Date(cx.ultimo_refresh_em).getTime()) / 86400000,
            )
            : null,
          webhook_registrado: !!cx?.webhook_endpoint_id,
          ultimo_erro: cx?.ultimo_erro ?? null,
          cobrancas_abertas: pendentes ?? 0,
        });
      }

      case "testar_conexao": {
        if (role !== "admin") return json({ error: "sem_permissao" }, 403);
        await tokenDaOrg();                 // lança se não der
        const cx = await conexaoAtual();
        await db.from("integration_connections")
          .update({ ultimo_ok_em: new Date().toISOString(), ultimo_erro: null })
          .eq("id", cx!.id);
        return json({ ok: true, ambiente });
      }

      case "registrar_webhook": {
        if (role !== "admin") return json({ error: "sem_permissao" }, 403);
        const cx = await conexaoAtual();
        if (!cx) return json({ error: "nao_conectado" }, 404);
        if (!CORA_ENV.WEBHOOK_TOKEN) return json({ error: "webhook_sem_token" }, 503);

        // O token vai no PATH, não na query: não há garantia de que a Cora
        // aceite query string no cadastro de endpoint.
        const url =
          `${BASE_ENV.SUPABASE_URL}/functions/v1/cora-webhook/${CORA_ENV.WEBHOOK_TOKEN}`;
        const r = await registrarWebhook(url, crypto.randomUUID());
        await db.from("integration_connections").update({
          webhook_endpoint_id: so((r as Record<string, unknown>).id) || null,
          webhook_url: url,
          webhook_registrado_em: new Date().toISOString(),
        }).eq("id", cx.id);
        await registrarLog("integracao.webhook_registrado", "integration_connection",
          cx.id, { provider: PROVIDER, ambiente }, userId);
        return json({ ok: true, endpoint_id: (r as Record<string, unknown>).id ?? null });
      }

      // ── Emitir cobrança ──
      case "emitir": {
        const receivableId = so(body.receivable_id);
        if (!receivableId) return json({ error: "receivable_id_obrigatorio" }, 400);

        const { data: rec } = await db.from("financial_receivables")
          .select("*, client:clients(*)").eq("id", receivableId).maybeSingle();
        if (!rec) return json({ error: "recebivel_nao_encontrado" }, 404);
        if (rec.status === "cancelado") return json({ error: "recebivel_cancelado" }, 422);
        if (rec.status === "pago") return json({ error: "recebivel_ja_pago" }, 422);
        if (!(Number(rec.value) > 0)) return json({ error: "valor_invalido" }, 422);
        if (!rec.due_date) return json({ error: "sem_vencimento" }, 422);

        const { faltando, cliente } = clienteParaCora(
          rec.client as Record<string, unknown> | null,
        );
        if (!cliente) return json({ error: "cliente_incompleto", faltando }, 422);

        // Cobrança viva já existente: não emite outra. O índice parcial
        // uniq_charge_viva_por_recebivel garante isso no banco também.
        const { data: viva } = await db.from("payment_charges")
          .select("*").eq("receivable_id", receivableId)
          .not("status", "in", "(cancelada,falha_envio)").maybeSingle();
        if (viva && viva.provider_charge_id) {
          return json({ error: "cobranca_ja_existe", cobranca: viva }, 409);
        }

        const valorCentavos = reaisParaCentavos(rec.value);

        // Padrões da organização. O modal pode sobrepor, mas o que vale por
        // omissão é o que está configurado em Integrações → Cora.
        const { data: cfg } = await db.from("charge_settings")
          .select("*").maybeSingle();

        const formasPadrao = [
          ...(cfg?.gerar_boleto !== false ? ["BANK_SLIP"] : []),
          ...(cfg?.gerar_pix !== false ? ["PIX"] : []),
        ];
        const formas = Array.isArray(body.formas) && body.formas.length
          ? (body.formas as string[]).filter((f) => ["BANK_SLIP", "PIX"].includes(f))
          : (formasPadrao.length ? formasPadrao : ["BANK_SLIP", "PIX"]);

        // UNIDADES, e é onde é fácil errar: a configuração guarda a multa em
        // PERCENTUAL (é como se contrata), mas a Cora quer
        // payment_terms.fine.amount em CENTAVOS. Já os juros ela quer em
        // percentual ao mês, então vão direto.
        const multaCentavos = body.multa_centavos !== undefined
          ? Number(body.multa_centavos) || 0
          : (cfg?.aplicar_multa
            ? Math.round(valorCentavos * Number(cfg.multa_percentual) / 100)
            : 0);

        const jurosPercentual = body.juros_percentual !== undefined
          ? Number(body.juros_percentual) || 0
          : (cfg?.aplicar_juros ? Number(cfg.juros_percentual_mes) : 0);

        const descontoPercentual = body.desconto_percentual !== undefined
          ? Number(body.desconto_percentual) || 0
          : (cfg?.aplicar_desconto ? Number(cfg.desconto_percentual) : 0);

        // A linha nasce ANTES da chamada, com a idempotency_key gravada. Um
        // duplo-clique ou um retry após timeout reusa esta linha e esta chave,
        // em vez de registrar um segundo boleto no banco do cliente.
        let charge = viva;
        if (!charge) {
          const { data: nova, error: erroIns } = await db.from("payment_charges")
            .insert({
              receivable_id: receivableId,
              client_id: rec.client_id,
              ambiente,
              status: "enviando",
              valor_centavos: valorCentavos,
              vencimento: rec.due_date,
              formas,
              cliente_snapshot: cliente,
              criado_por: userId,
            }).select().single();
          if (erroIns) {
            if (/uniq_charge_viva_por_recebivel/.test(erroIns.message)) {
              return json({ error: "cobranca_ja_existe" }, 409);
            }
            throw new ErroCora("gravacao_falhou", erroIns.message);
          }
          charge = nova;
        }

        try {
          const inv = await criarCobranca({
            code: charge!.id,
            cliente,
            descricao: so(rec.description) || "Serviço prestado",
            valorCentavos,
            vencimento: String(rec.due_date).slice(0, 10),
            multaCentavos: multaCentavos || undefined,
            jurosPercentualMes: jurosPercentual || undefined,
            descontoPercentual: descontoPercentual || undefined,
            formas,
            idempotencia: charge!.idempotency_key,
          });

          const pag = extrairPagamento(inv);
          const { data: atualizada } = await db.from("payment_charges").update({
            provider_charge_id: so(inv.id),
            provider_status: so(inv.status),
            status: traduzStatus(so(inv.status)),
            ...pag,
            provider_payload: inv,
            tentativas: (charge!.tentativas ?? 0) + 1,
            ultimo_erro: null,
          }).eq("id", charge!.id).select().single();

          await registrarLog("cobranca.criada", "payment_charge", charge!.id, {
            receivable_id: receivableId,
            provider_charge_id: inv.id,
            valor_centavos: valorCentavos,
          }, userId);

          return json({ ok: true, cobranca: atualizada });
        } catch (e) {
          const err = e as ErroCora;
          await db.from("payment_charges").update({
            status: "falha_envio",
            tentativas: (charge!.tentativas ?? 0) + 1,
            ultimo_erro: err.detalhe ?? err.codigo,
          }).eq("id", charge!.id);
          throw err;
        }
      }

      // ── Consultar e conciliar uma cobrança ──
      case "consultar": {
        const chargeId = so(body.charge_id);
        const { data: c } = await db.from("payment_charges")
          .select("*").eq("id", chargeId).maybeSingle();
        if (!c || !c.provider_charge_id) return json({ error: "cobranca_nao_encontrada" }, 404);

        const inv = await consultarCobranca(c.provider_charge_id, c.ambiente);
        const r = await db.rpc("cora_liquidar_cobranca", {
          p_provider_charge_id: c.provider_charge_id,
          p_provider_status: so(inv.status),
          p_total_paid_cents: Number(inv.total_paid ?? 0),
          p_occurrence_date: (inv.occurrence_date as string) ?? null,
          p_forma_pagamento: so(inv.status) === "PAID"
            ? (c.formas?.includes("PIX") ? "PIX" : "Boleto")
            : null,
          p_payload: inv,
        });
        return json({ ok: true, resultado: r.data });
      }

      case "cancelar": {
        const chargeId = so(body.charge_id);
        const { data: c } = await db.from("payment_charges")
          .select("*").eq("id", chargeId).maybeSingle();
        if (!c || !c.provider_charge_id) return json({ error: "cobranca_nao_encontrada" }, 404);

        const r = await cancelarCobranca(c.provider_charge_id, c.ambiente);
        if (r === "ja_paga") {
          // Não é erro: é estado. Concilia na hora e conta o que aconteceu.
          const inv = await consultarCobranca(c.provider_charge_id, c.ambiente);
          await db.rpc("cora_liquidar_cobranca", {
            p_provider_charge_id: c.provider_charge_id,
            p_provider_status: so(inv.status),
            p_total_paid_cents: Number(inv.total_paid ?? 0),
            p_occurrence_date: (inv.occurrence_date as string) ?? null,
            p_forma_pagamento: "Boleto",
            p_payload: inv,
          });
          return json({ ok: false, motivo: "ja_paga" });
        }

        await db.from("payment_charges")
          .update({ status: "cancelada", provider_status: "CANCELLED" })
          .eq("id", c.id);
        await registrarLog("cobranca.cancelada", "payment_charge", c.id, {
          provider_charge_id: c.provider_charge_id,
        }, userId);
        return json({ ok: true });
      }

      // ── Rede de segurança para quando o webhook não chegar ──
      case "reconciliar": {
        const limite = Math.min(Number(body.limite) || 10, 25);
        const { data: abertas } = await db.from("payment_charges")
          .select("id, provider_charge_id, ambiente, formas")
          .in("status", ["aberta", "em_pagamento", "vencida"])
          .not("provider_charge_id", "is", null)
          .order("updated_at", { ascending: true })
          .limit(limite);

        const resultados: unknown[] = [];
        for (const c of abertas ?? []) {
          try {
            const inv = await consultarCobranca(c.provider_charge_id!, c.ambiente);
            const r = await db.rpc("cora_liquidar_cobranca", {
              p_provider_charge_id: c.provider_charge_id,
              p_provider_status: so(inv.status),
              p_total_paid_cents: Number(inv.total_paid ?? 0),
              p_occurrence_date: (inv.occurrence_date as string) ?? null,
              p_forma_pagamento: so(inv.status) === "PAID"
                ? (c.formas?.includes("PIX") ? "PIX" : "Boleto")
                : null,
              p_payload: inv,
            });
            resultados.push({ id: c.id, resultado: r.data });
          } catch (e) {
            // Uma cobrança problemática não pode parar a varredura das outras.
            resultados.push({ id: c.id, erro: (e as ErroCora).codigo });
          }
        }
        return json({ ok: true, conferidas: resultados.length, resultados });
      }

      case "desconectar": {
        if (role !== "admin") return json({ error: "sem_permissao" }, 403);
        const cx = await conexaoAtual();
        if (!cx) return json({ ok: true });
        await db.from("integration_connections").update({
          status: "desconectado",
          access_token: null, refresh_token: null, access_expires_at: null,
          desconectado_em: new Date().toISOString(),
        }).eq("id", cx.id);
        await registrarLog("integracao.desconectada", "integration_connection",
          cx.id, { provider: PROVIDER }, userId);
        return json({ ok: true });
      }

      // provider_webhook_events é deny-all: esta ação é o único caminho de
      // leitura do histórico.
      case "eventos": {
        if (role !== "admin") return json({ error: "sem_permissao" }, 403);
        const { data } = await db.from("provider_webhook_events")
          .select("event_id, event_type, resource_id, recebido_em, processado_em, resultado, erro")
          .eq("provider", PROVIDER)
          .order("recebido_em", { ascending: false })
          .limit(Math.min(Number(body.limite) || 20, 100));
        return json({ eventos: data ?? [] });
      }

      default:
        return json({ error: "acao_desconhecida" }, 400);
    }
  } catch (e) {
    const err = e as ErroCora;
    const codigo = err.codigo ?? "cora_api_falhou";
    console.error("cora falhou:", codigo, err.detalhe ?? err.message);
    // Estados esperados devolvem o código do estado, não 500: o front usa
    // isso para mostrar o botão de conectar em vez de uma tela de erro.
    const http = codigo === "nao_conectado"
      ? 404
      : codigo === "reautorizar"
      ? 401
      : codigo === "cora_nao_configurada"
      ? 503
      : 502;
    return json({ error: codigo }, http);
  }
});
