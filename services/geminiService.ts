
import { GoogleGenAI } from "@google/genai";
import { Player } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getLineupSuggestion = async (
  players: Player[],
  availablePlayerIds: string[],
  opponentDescription: string,
  focus: 'aggressive' | 'defensive' | 'balanced'
): Promise<{ lineup: {player1Id: string, player2Id: string}[], reasoning: string }> => {
  
  // Filter players based on availability
  const availablePlayers = players.filter(p => availablePlayerIds.includes(p.id));

  // Send IDs to map them back easily
  const rosterStr = JSON.stringify(availablePlayers.map(p => ({
    id: p.id,
    name: `${p.name} ${p.surname || ''}`.trim(),
    position: p.position,
    level: p.level,
    winRate: p.matchesPlayed > 0 ? (Number(p.wins) / Number(p.matchesPlayed)).toFixed(2) : '0.00'
  })));

  const prompt = `
    Actúa como un capitán experto de pádel.
    Tengo estos jugadores DISPONIBLES para hoy (JSON): ${rosterStr}.
    Rival: "${opponentDescription}".
    Estrategia: "${focus}".
    
    Genera una alineación de 5 parejas (o las que se puedan formar con los jugadores disponibles).
    Prioriza el equilibrio y la posición natural (Drive/Revés) si es posible.
    
    IMPORTANTE: Tu respuesta DEBE ser un objeto JSON válido (sin markdown, sin bloques de código \`\`\`json) con esta estructura exacta:
    {
      "lineup": [
        { "player1Id": "id_del_jugador", "player2Id": "id_del_jugador" },
        ...
      ],
      "reasoning": "Breve explicación táctica de por qué elegiste estas parejas y el orden."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: {
        responseMimeType: "application/json" // Force JSON output
      }
    });

    const text = response.text || "{}";
    // Clean up if model adds markdown despite instructions
    const jsonStr = text.replace(new RegExp('```json', 'g'), '').replace(new RegExp('```', 'g'), '').trim();
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error("Error calling Gemini:", error);
    return { lineup: [], reasoning: "Hubo un error al conectar con la IA táctica." };
  }
};

export const analyzeMatchStats = async (wins: number, losses: number, totalGames: number): Promise<string> => {
    const prompt = `Analiza brevemente esta temporada de pádel: ${wins} victorias, ${losses} derrotas en ${totalGames} partidos. Dame un consejo de una frase para mejorar la moral del equipo.`;
    
    try {
         const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', 
            contents: prompt,
        });
        return response.text || "Sigue entrenando duro.";
    } catch (e) {
        return "A seguir mejorando.";
    }
}
