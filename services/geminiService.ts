
import { GoogleGenAI } from "@google/genai";
import { Player, MatchDay } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AIAnalysisResult {
    summary: string;
    details: string;
    tip: string;
}

export const getLineupSuggestion = async (
  players: Player[],
  availablePlayerIds: string[],
  opponentDescription: string
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
    
    Genera una alineación de hasta 5 parejas usando SOLO los IDs de los jugadores disponibles.
    Prioriza el equilibrio y la posición natural (Drive/Revés).
    
    RESPONDE SOLO CON JSON. No uses markdown.
    Estructura:
    {
      "lineup": [
        { "player1Id": "id_del_jugador", "player2Id": "id_del_jugador" }
      ],
      "reasoning": "Breve explicación táctica..."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    // Clean up if model adds markdown despite instructions
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error("Error calling Gemini:", error);
    return { lineup: [], reasoning: "Hubo un error al conectar con la IA táctica. Inténtalo de nuevo." };
  }
};

export const analyzeTeamStats = async (context: any): Promise<AIAnalysisResult> => {
    // Return early if no data to avoid wasting tokens on empty stats
    const emptyResult = {
        summary: "Comienza la temporada para generar datos.",
        details: "Registra jornadas y partidos para obtener insights.",
        tip: "¡A entrenar!"
    };

    if (context.totalMatchDays === 0) return emptyResult;

    const prompt = `
        Eres un analista deportivo de élite (Data Scientist & Coach de Pádel).
        
        DATOS DEL EQUIPO (JSON):
        ${JSON.stringify(context, null, 2)}
        
        TAREA: Analiza los datos y devuelve un JSON con 3 campos distintos.
        
        IMPORTANTE SOBRE LA RACHA: "recentStreakChronological" muestra el orden HISTÓRICO (Antiguo -> Reciente). 
        Ejemplo: "LOSS -> WIN -> WIN" significa que perdieron hace 3 partidos, pero han ganado los dos últimos. ¡Es una racha positiva!
        
        IMPORTANTE SOBRE EL MVP: Si el campo mvpPlayer dice 'N/A', NO inventes un jugador.
        
        ESTRUCTURA DE RESPUESTA (JSON):
        {
           "summary": "Resumen estratégico (aprox. 40 palabras). Evalúa la consistencia global, dinámica de victorias/derrotas y momento de forma actual.",
           "details": "Análisis táctico profundo (aprox. 50 palabras). Conecta el rendimiento Casa/Fuera con la racha reciente, el impacto del MVP (si hay) y áreas críticas de mejora.",
           "tip": "Directriz Táctica (aprox. 30 palabras). NO des consejos motivacionales genéricos. Da una instrucción técnica específica y 'REAL' basada en los fallos/aciertos probables según las estadísticas (ej: 'Trabajar el volumen de juego aéreo en pistas lentas', 'Ajustar la posición de defensa ante rivales superiores')."
        }

        TONO: Profesional, técnico y directo.
    `;
    
    try {
         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });
        const text = response.text || "{}";
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error(e);
        return {
            summary: "Error analizando datos.",
            details: "Inténtalo de nuevo más tarde.",
            tip: "Sigue jugando."
        };
    }
}

export const extractScheduleFromImage = async (
    base64Image: string, 
    myClubName: string
): Promise<Partial<MatchDay>[]> => {
    const currentYear = new Date().getFullYear();
    const prompt = `
        Analiza esta imagen de un calendario de liga de pádel.
        Extrae la lista de partidos (Jornadas).
        
        CONTEXTO:
        - Año actual: ${currentYear} (Usa este año para las fechas, si cruza de año usa lógica).
        - Mi Club/Sede: "${myClubName}". 
        - Si la columna "Sede" o "Lugar" coincide con "${myClubName}", entonces isHome = true. Si no, isHome = false.
        - Si la fecha es un rango (ej: "16-18 ENERO"), elige el viernes o el primer día del rango como fecha por defecto.
        - Formato de hora: Si aparece (ej: "20:00"), añádelo a la fecha. Si no, usa "20:00" por defecto.
        
        DEVUELVE SOLO UN JSON ARRAY:
        [
            {
                "date": "ISO STRING (YYYY-MM-DDTHH:mm:ss)",
                "opponent": "Nombre del equipo rival",
                "isHome": boolean,
                "locationName": "Nombre de la sede leída en la imagen"
            }
        ]
    `;

    try {
        // Strip header if present (data:image/jpeg;base64,...)
        const cleanBase64 = base64Image.split(',')[1] || base64Image;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: cleanBase64
                    }
                },
                { text: prompt }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "[]";
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const rawData = JSON.parse(jsonStr);
        
        // Map to Partial<MatchDay>
        return rawData.map((item: any, index: number) => ({
            id: `imported_${Date.now()}_${index}`,
            date: item.date,
            opponent: item.opponent,
            isHome: item.isHome,
            lineups: [],
            tandas: '5',
            notes: `Sede: ${item.locationName || 'Desconocida'}` // Store venue in notes
        }));

    } catch (error) {
        console.error("Error parsing calendar image:", error);
        throw new Error("No se pudo leer el calendario. Asegúrate que la imagen sea clara.");
    }
};
