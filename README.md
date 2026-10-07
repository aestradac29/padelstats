# 🎾 Padel Stats Pro — El Gestor Definitivo para Capitanes de Pádel

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-8E75C2?style=for-the-badge&logo=google-gemini&logoColor=white)](https://ai.google.dev/)

**Padel Stats Pro** es una plataforma integral y altamente interactiva diseñada para capitanes y coordinadores de equipos de pádel. Permite la administración ágil de jugadores, estadísticas detalladas, parejas, jornadas de liga regular y eliminatorias de playoffs, todo potenciado por inteligencia artificial para la generación de alineaciones estratégicas e importación inteligente de datos.

---

## ✨ Características Principales

### 📈 1. Cuadro de Mando y Estadísticas Interactivos
* **Dashboard Completo:** Visualización en tiempo real del estado del equipo, asistencias, ratios de victoria y evolución temporal del rendimiento de cada jugador mediante gráficos dinámicos (`Recharts`).
* **Sistemas de Puntuación Flexibles:** Configuración de puntuaciones personalizables (estándar, asistencia, o por rangos dinámicos en base a los puntos actuales del jugador).
* **Partidos en Calidad de Préstamo (*Loan Matches*):** Gestión de jugadores cedidos o que juegan en otras categorías, aplicando de forma consistente las reglas de puntuación del equipo de origen.

### 👥 2. Análisis de Parejas (*Pairs Synergy*)
* **Rendimiento de Duplas:** Registro automático de estadísticas agregadas para cada combinación de dos jugadores.
* **Métricas de Sinergia:** Porcentaje de efectividad, sets ganados/perdidos y racha de victorias de las parejas en pista para tomar decisiones basadas en datos.

### 📅 3. Gestión Integral de Jornadas y Eliminatorias
* **Liga Regular (*Matchdays*):** Gestión ágil de jornadas con soporte para partidos de local o visitante (`isHome` / `isAway`), adaptando de manera automática el orden de los jugadores de acuerdo con la alineación del acta oficial de la federación.
* **Módulo de Playoffs Avanzado:** Soporte completo para eliminatorias a ida y vuelta, cabezas de serie (*seeds*), control de localía y generación de actas con modales dinámicos (`React Portals`) para una interfaz de usuario limpia y sin obstrucciones.

### 🧠 4. Potenciado por Inteligencia Artificial (Google Gemini SDK)
* **Importación Óptica Inteligente:** Sube una imagen o captura de pantalla del acta oficial de la federación y, mediante visión artificial con los últimos modelos de **Gemini (3.5-Flash)**, la aplicación procesará, extraerá y ordenará automáticamente la jornada con sus sets, emparejamientos y resultados, emparejando los nombres con tu plantilla de jugadores.
* **Generador Estratégico de Alineaciones:** Algoritmo que utiliza la API de Gemini para analizar el histórico de tus jugadores, compatibilidades, disponibilidad y rendimiento histórico frente al tipo de rival para sugerir la alineación más óptima y maximizar las posibilidades de victoria.

### 🔒 5. Sincronización en la Nube y Multi-dispositivo
* Integración nativa con **Firebase Authentication** y **Cloud Firestore** para mantener la privacidad de los datos, permitir el acceso seguro por parte de los capitanes autorizados y mantener la información perfectamente sincronizada en tiempo real.

---

## 🛠️ Stack Tecnológico

* **Frontend:** React 18, TypeScript, Vite.
* **Estilos:** Tailwind CSS con diseño adaptivo (*Mobile-First*) y modo oscuro automático/manual.
* **Modelos de IA:** SDK Oficial `@google/genai` (integrando Gemini 3.5-Flash).
* **Base de Datos y Seguridad:** Firebase Auth & Firestore, configurado con reglas estrictas de acceso (`firestore.rules`).
* **Gráficos e Informes:** Recharts para la analítica de rendimiento y visualización de tendencias.
* **Utilidades de Datos:** XLSX para la exportación y migración masiva de plantillas y datos en formato Excel.

---

## 🚀 Instalación y Configuración Local

Sigue estos pasos para ejecutar **Padel Stats Pro** en tu máquina local:

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/padel-stats-pro.git
cd padel-stats-pro
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env.local` en la raíz del proyecto (puedes basarte en `.env.example`) y añade tus credenciales de Firebase y tu API Key de Gemini:

```env
# Google Gemini API
VITE_GEMINI_API_KEY=tu_api_key_de_gemini

# Firebase Configuration
VITE_FIREBASE_API_KEY=tu_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### 4. Lanzar el servidor de desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000` (o el puerto configurado por Vite).

---

## 📂 Estructura del Proyecto

```text
├── components/            # Componentes reutilizables e iconografía
│   ├── views/             # Vistas de la aplicación (Dashboard, Playoffs, Players, etc.)
│   ├── Icons.tsx          # Colección de iconos en SVG (Lucide React style)
│   ├── Toast.tsx          # Componente de notificaciones emergentes
│   └── UIComponents.tsx   # Botones, tarjetas, modales y diálogos de confirmación
├── services/              # Integraciones con servicios externos
│   ├── firebase.ts        # Inicialización de Auth y Firestore
│   └── geminiService.ts   # Integración del SDK de Gemini (procesamiento de imágenes y alineaciones)
├── utils/                 # Funciones auxiliares y constantes del negocio
│   ├── constants.ts       # Rangos de categorías y presets
│   └── helpers.ts         # Formateadores de fechas, algoritmos de puntos, etc.
├── App.tsx                # Punto de entrada principal y gestor de estado global
├── index.html             # Plantilla HTML base
├── types.ts               # Definiciones de tipos TypeScript (Player, MatchDay, Playoffs, etc.)
└── package.json           # Scripts del proyecto y dependencias
```

---

## 🔧 Scripts Disponibles

En el directorio del proyecto, puedes ejecutar los siguientes scripts:

* `npm run dev`: Inicia el servidor de desarrollo en local con soporte para recarga en caliente.
* `npm run build`: Compila la aplicación de TypeScript a archivos estáticos optimizados para producción en la carpeta `/dist`.
* `npm run lint`: Ejecuta el linter (ESLint) y realiza el chequeo estático de tipos con TypeScript (`tsc --noEmit`).
* `npm run preview`: Sirve localmente los archivos compilados en producción para probar el rendimiento del bundle final.

---

## 🛡️ Seguridad y Despliegue

La aplicación está optimizada para ser desplegada en plataformas de hosting estático (como Vercel, Netlify o Firebase Hosting).

Al desplegar, asegúrate de:
1. Configurar las variables de entorno en el panel de control de tu proveedor de hosting.
2. Aplicar las reglas de seguridad contenidas en `firestore.rules` a tu base de datos Firestore para asegurar que los usuarios autenticados solo puedan leer y escribir su propia información autorizada.

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.

---
*Desarrollado con pasión para llevar la gestión de los equipos de pádel al siguiente nivel usando Inteligencia Artificial.* 🎾⚡
