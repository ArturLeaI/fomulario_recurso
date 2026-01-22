const API_URL = import.meta.env.VITE_API_URL as string;

async function parseResponse(resp: Response) {
  const contentType = resp.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await resp.json().catch(() => null)
    : await resp.text().catch(() => "");

  return { contentType, data };
}

function extractErrorMessage(data: any) {
  if (typeof data === "string") return data;

  // suporta vários formatos comuns
  return (
    data?.error ||
    data?.message ||
    data?.msg ||
    data?.detail ||
    (Array.isArray(data?.errors) ? data.errors.map((e: any) => e?.message || e).join(" | ") : null) ||
    "Erro ao enviar solicitação"
  );
}

export async function postAcaoVagas(payload: any) {
  // ✅ NÃO valida quantidade para desistência (nem quando não tem cursos)
  if (payload?.tipoAcao !== "descredenciar vaga") {
    const cursos =
      payload?.cursos ??
      payload?.cursosAdicionar ?? // mudanca_curso (destino)
      payload?.cursosRemover;     // mudanca_curso (origem)

    if (Array.isArray(cursos) && cursos.some((c: any) => Number(c?.quantidade) <= 0)) {
      throw new Error("Quantidade deve ser maior que zero");
    }
  }

  const resp = await fetch(`${API_URL}/recursos/acoes-vagas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const { data } = await parseResponse(resp);

  if (!resp.ok) {
    throw new Error(extractErrorMessage(data));
  }

  return data;
}

export async function postGestor(payload: { nome: string; cpf: string; email: string }) {
  const resp = await fetch(`${API_URL}/gestores/validar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const { data } = await parseResponse(resp);

  if (!resp.ok) {
    // mantém o comportamento de sempre jogar Error com mensagem legível
    throw new Error(extractErrorMessage(data));
  }

  return data;
}
