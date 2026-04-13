
import { GoogleGenAI } from "@google/genai";
import { Player, MatchDay, MatchResult, MatchLineup } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export const extractScheduleFromExcel = async (
    excelData: any[]
): Promise<Partial<MatchDay>[]> => {
    const currentYear = new Date().getFullYear();
    const prompt = `
        Analiza estos datos extraídos de un archivo Excel de un calendario de pádel.
        Convierte los datos a una lista de objetos MatchDay.
        
        DATOS EXCEL (JSON):
        ${JSON.stringify(excelData)}
        
        INSTRUCCIONES CRÍTICAS:
        1. "Fecha" y "Hora": Combínalos en un ISO String válido (YYYY-MM-DDTHH:mm:ss). Si el año no está claro, asume ${currentYear}. Si la fecha viene como número (ej. 45432), es un número de serie de Excel, conviértelo a fecha.
        2. "Local/Visitante": Si incluye "Local" o "L", isHome = true. Si incluye "Visitante" o "V", isHome = false.
        3. "Rival": Nombre del equipo rival. Si es jornada de descanso, puedes poner "Descanso".
        4. "Sede/Notas": Guárdalo en el campo 'notes'.
        5. "Modo Historico": Si el valor es "Si", "Sí", "Yes" o "Y", devuelve ignorePoints = true. De lo contrario, false.
        6. "Jornada de descanso": Si el valor es "Si", "Sí", "Yes" o "Y", devuelve isRestDay = true. De lo contrario, false.
        7. "Tandas (Ej. 2-2-1)": Devuelve exactamente el valor proporcionado como texto (ej: "2-1-2", "1-2-2", "2-3"). Si está vacío, devuelve "5".
        
        DEVUELVE SOLO UN JSON ARRAY CON ESTA ESTRUCTURA EXACTA:
        [
            {
                "date": "ISO STRING",
                "opponent": "Nombre Rival",
                "isHome": boolean,
                "notes": "Notas/Sede",
                "tandas": "string",
                "ignorePoints": boolean,
                "isRestDay": boolean
            }
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "[]";
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const rawData = JSON.parse(jsonStr);
        
        return rawData.map((item: any, index: number) => ({
            id: `imported_excel_${Date.now()}_${index}`,
            date: item.date,
            opponent: item.opponent || 'Desconocido',
            isHome: !!item.isHome,
            lineups: [],
            tandas: item.tandas ? String(item.tandas) : '5',
            notes: item.notes || '',
            ignorePoints: !!item.ignorePoints,
            isRestDay: !!item.isRestDay
        }));

    } catch (error) {
        console.error("Error parsing excel data with AI:", error);
        throw new Error("No se pudo procesar el archivo Excel. Revisa el formato.");
    }
};

export const extractScheduleFromFederationImage = async (
    base64Image: string,
    players?: Player[]
): Promise<Partial<MatchDay>[]> => {
    const currentYear = new Date().getFullYear();

    const rosterInfo = players && players.length > 0
        ? `\n\nJUGADORES DE MI EQUIPO (intenta hacer matching de nombres por similitud):
${JSON.stringify(players.map(p => ({ id: p.id, name: p.name })))}`
        : '';

    const prompt = `
        Analiza esta imagen de un acta de partido de pádel de la federación.
        Extrae TODA la información visible del acta.
        
        INSTRUCCIONES:
        1. "Jornada" y "Orden de las tandas": Extrae ambos valores.
        2. "Fecha eliminatoria": Extrae la fecha y hora → ISO String (YYYY-MM-DDTHH:mm:ss). Asume año ${currentYear}.
        3. "Lugar/Sede": Extrae el nombre del lugar.
        4. Equipos: Identifica el equipo "Local" y el "Visitante". El campo "opponent" debe ser el equipo contrario al local (si isHome=true, opponent = nombre equipo visitante; si isHome=false, opponent = nombre equipo local).
        5. "Listado de partidos": Extrae TODOS los partidos. Para cada partido:
           - Número de partido (pairNumber)
           - player1Name: primer jugador LOCAL
           - player2Name: segundo jugador LOCAL  
           - opponent1Name: primer jugador VISITANTE
           - opponent2Name: segundo jugador VISITANTE
           - Puntos individuales de cada jugador (campo opponentPoints = suma puntos pareja visitante)
           - Sets ganados por local vs visitante
           - Parciales: extrae cada set por separado como "set1", "set2", "set3" en formato "6-1", "7-5", etc.
           - result: "Victoria" si el local ganó ese partido, "Derrota" si el visitante ganó.
        6. isHome: Asume true (el equipo que usa esta app es el Local) salvo que puedas deducir lo contrario.
        7. tandas: Usa el valor "Orden de las tandas" como string (ej: "5").${rosterInfo}
        
        DEVUELVE SOLO UN JSON ARRAY CON ESTA ESTRUCTURA EXACTA (sin markdown):
        [
            {
                "opponent": "Nombre equipo rival",
                "isHome": true,
                "date": "ISO STRING",
                "notes": "Jornada X · Sede: Y",
                "tandas": "5",
                "lineups": [
                    {
                        "pairNumber": 1,
                        "player1Name": "Nombre Jugador Local 1",
                        "player2Name": "Nombre Jugador Local 2",
                        "player1Id": "",
                        "player2Id": "",
                        "opponent1Name": "Nombre Jugador Visitante 1",
                        "opponent2Name": "Nombre Jugador Visitante 2",
                        "set1": "6-1",
                        "set2": "7-5",
                        "set3": "",
                        "result": "Victoria"
                    }
                ]
            }
        ]
    `;

    try {
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

        // Helper: match player name to roster ID
        const findPlayerId = (name: string): string => {
            if (!name || !players?.length) return '';
            const norm = name.toLowerCase().trim();
            const found = players.find(p => {
                const full = `${p.name} ${p.surname || ''}`.toLowerCase().trim();
                const first = p.name.toLowerCase();
                return full === norm || first === norm ||
                    norm.includes(first) || full.includes(norm);
            });
            return found?.id || '';
        };
        
        return rawData.map((item: any, index: number) => ({
            id: `imported_fed_${Date.now()}_${index}`,
            date: item.date,
            opponent: item.opponent,
            isHome: item.isHome ?? true,
            notes: item.notes || '',
            tandas: item.tandas ? String(item.tandas) : '5',
            ignorePoints: false,
            lineups: (item.lineups || []).map((l: any, i: number) => ({
                pairNumber: l.pairNumber || (i + 1),
                player1Name: l.player1Name || '',
                player2Name: l.player2Name || '',
                player1Id: l.player1Id || findPlayerId(l.player1Name || ''),
                player2Id: l.player2Id || findPlayerId(l.player2Name || ''),
                opponent1Name: l.opponent1Name || '',
                opponent2Name: l.opponent2Name || '',
                set1: l.set1 || '',
                set2: l.set2 || '',
                set3: l.set3 || '',
                result: l.result || 'Derrota',
            }))
        }));

    } catch (error) {
        console.error("Error parsing federation image:", error);
        throw new Error("No se pudo procesar la imagen del acta.");
    }
};

export const parseMatchDetailsFromText = async (
    rawText: string,
    players: Player[]
): Promise<Partial<MatchDay>> => {
    
    // Simplificar lista de jugadores para la IA
    const roster = players.map(p => ({
        id: p.id,
        name: p.name,
        surname: p.surname
    }));

    const currentDate = new Date().toISOString();

    const prompt = `
        Analiza el siguiente texto copiado de WhatsApp con los resultados de una jornada de pádel.
        
        TEXTO ORIGINAL:
        """
        ${rawText}
        """

        JUGADORES DE MI EQUIPO (Usa sus IDs):
        ${JSON.stringify(roster)}
        
        INSTRUCCIONES:
        1. Identifica la FECHA y HORA. Usa el año actual (${new Date().getFullYear()}). Devuelve ISO String.
        2. Identifica el RIVAL. Normalmente está en la primera línea. Si pone algo como "Racket Z - G6 All black", y mi equipo no sé cuál es, asume que el rival es el nombre que NO parece una sede o que parece un equipo contrario.
        3. Identifica la SEDE/LUGAR y ponlo en 'notes'.
        4. Identifica las TANDAS (ej: '3-2').
        5. Identifica si es CASA o FUERA (isHome). Si la sede coincide con el nombre del primer equipo mencionado, suele ser casa. Usa tu criterio.
        6. EXTRAE LAS ALINEACIONES (Lineups):
           - Busca patrones como "1 Luis - Cristian 6-3 6-4 👍🏻".
           - Mapea los nombres (Luis, Cristian) a los IDs de mi lista de jugadores. Si no encuentras coincidencia exacta, usa la más cercana fonéticamente. Si es un jugador desconocido, déjalo vacío.
           - Extrae los sets (ej: "6-3", "6-4").
           - Extrae el resultado: 👍🏻, ✅, WIN, GANADO = 'Victoria'. 👎🏻, ❌, LOSS, PERDIDO = 'Derrota'.
        
        DEVUELVE SOLO JSON CON ESTA ESTRUCTURA (MatchDay):
        {
            "date": "ISO_STRING",
            "opponent": "Nombre Rival",
            "isHome": boolean,
            "tandas": "string (ej: 3-2)",
            "notes": "Sede encontrada",
            "lineups": [
                {
                    "player1Id": "id_found_or_empty",
                    "player2Id": "id_found_or_empty",
                    "set1": "6-0",
                    "set2": "6-0",
                    "set3": "",
                    "result": "Victoria" | "Derrota" | "Empate"
                }
            ]
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
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Error parsing text match:", error);
        throw new Error("No se pudo interpretar el texto. Revisa el formato.");
    }
};
