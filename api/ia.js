// Nome do modelo num só lugar, fácil de trocar se o Groq mudar a lista
const MODELO = "openai/gpt-oss-120b";
const LIMITE_TEXTO = 12000;

const NIVEIS = {
  curto: "um resumo curto, de 3 a 4 frases",
  medio: "um resumo médio, de 1 a 2 parágrafos",
  detalhado: "um resumo detalhado, em tópicos, explicando cada ideia importante",
};

function montarPrompt(tipo, texto, nivel) {
  if (tipo === "resumo") {
    return `Faça ${NIVEIS[nivel]} do texto abaixo, em português do Brasil.\n\nTEXTO:\n${texto}`;
  }
  return `Crie um quiz de 5 perguntas de múltipla escolha, em português do Brasil, sobre o texto abaixo.
Responda SOMENTE com JSON válido, sem nenhum texto antes ou depois e sem markdown, neste formato:
[{"pergunta": "...", "opcoes": ["A", "B", "C", "D"], "correta": 0, "explicacao": "..."}]
"correta" é o número (0 a 3) da opção certa.

TEXTO:
${texto}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Use o método POST." });
  }

  const { tipo, texto, nivel } = req.body || {};

  if (!["resumo", "quiz"].includes(tipo)) {
    return res.status(400).json({ erro: "Tipo inválido." });
  }
  if (!texto || texto.trim().length < 50) {
    return res.status(400).json({ erro: "Cole um texto com pelo menos 50 caracteres." });
  }
  if (texto.length > LIMITE_TEXTO) {
    return res.status(400).json({ erro: "Texto muito grande. Máximo de 12.000 caracteres." });
  }
  if (tipo === "resumo" && !NIVEIS[nivel]) {
    return res.status(400).json({ erro: "Nível inválido." });
  }

  try {
    const resposta = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODELO,
        messages: [{ role: "user", content: montarPrompt(tipo, texto, nivel) }],
      }),
    });

    if (resposta.status === 429) {
      return res.status(429).json({ erro: "Limite gratuito atingido. Tente de novo em um minuto." });
    }
    if (!resposta.ok) {
      return res.status(502).json({ erro: "A IA não respondeu. Tente novamente." });
    }

    const dados = await resposta.json();
    const conteudo = dados.choices?.[0]?.message?.content || "";
    return res.status(200).json({ resultado: conteudo });
  } catch (erro) {
    return res.status(500).json({ erro: "Erro no servidor." });
  }
};