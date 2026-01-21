const API_BASE = "http://localhost:3000";

export async function postAcaoVagas(payload: any) {
  const resp = await fetch(`${API_BASE}/recursos/acoes-vagas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = resp.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await resp.json()
    : await resp.text();

  if (!resp.ok) {
    const msg =
      typeof data === "string"
        ? data
        : data?.error || data?.message || "Erro ao enviar solicitação";
    throw new Error(msg);
  }

  return data;
}


export async function postGestor(payload: {
  nome: string;
  cpf: string;
  email: string;
}) {
  const res = await fetch("http://localhost:3000/gestores/validar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw err;
  }

  return res.json();
}

