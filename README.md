### CHATBOT Whatsapp Google Calendar (Baileys Provider)

# WhatsApp Chatbot con Google Calendar

Este repositorio contiene el código para un chatbot de WhatsApp que se conecta con Google Calendar para gestionar citas. A continuación, se detallan los pasos necesarios para configurar y ejecutar este proyecto.

## Requisitos Previos

1. Node.js y npm instalados en tu máquina.
2. Una cuenta de Google con acceso a Google Calendar.
3. Una cuenta en OpenAI.

## Configuración del Proyecto

### 1. Descargar Credenciales de Google

1. Ve a la [Consola de Google Cloud](https://console.cloud.google.com/).
2. Crea un proyecto nuevo o selecciona un proyecto existente.
3. Habilita la API de Google Calendar para tu proyecto.
4. Crea una cuenta de servicio (service account) y descarga el archivo `google.json` con las credenciales.
5. Guarda el archivo `google.json` en el directorio principal del código.

### 2. Crear y Compartir el Calendario

1. Abre Google Calendar y crea un nuevo calendario.
2. Comparte el calendario con el correo electrónico de la cuenta de servicio (service account) creada en el paso anterior.
3. Copia el ID del calendario. Lo necesitarás en el siguiente paso.

### 3. Configurar `calendar.js`

1. Abre el archivo `calendar.js` en tu editor de texto.
2. Reemplaza el `calendarId` con el ID del calendario que copiaste en el paso anterior.
3. Configura las siguientes constantes según tus necesidades:
   - `timezone`: Zona horaria del calendario (ejemplo: `"America/Argentina/Buenos_Aires"`).
   - `rangeLimit`: Límite de rango de fechas para las citas (ejemplo: `30` días).
   - `standardDuration`: Duración estándar de las citas en minutos (ejemplo: `60`).
   - `datelimit`: Límite de fechas para la creación de citas (ejemplo: `"2024-12-31"`).

### 4. Configurar la API de OpenAI

1. Crea un archivo `.env` en el directorio principal del proyecto.
2. Agrega tu clave API de OpenAI en el archivo `.env` de la siguiente manera:
OPENAI_API_KEY=tu_clave_api_de_openai


### 5. Instalar Dependencias y Ejecutar el Proyecto

1. Abre una terminal y navega hasta el directorio del proyecto.
2. Ejecuta el siguiente comando para instalar las dependencias necesarias: npm install
3. Ejecuta el siguiente comando para correr el bot: npm start

### 6. Conectar con WhatsApp
Sigue las instrucciones en la terminal para escanear el código QR con tu aplicación de WhatsApp.
Una vez conectado, el chatbot debería estar listo para interactuar y gestionar citas en tu Google Calendar.

Ahora que el chatbot está configurado y en funcionamiento, puedes empezar a usarlo para gestionar citas a través de WhatsApp. El chatbot se encargará de agendar las citas en tu Google Calendar de acuerdo con las configuraciones establecidas.

¡Y eso es todo! Si tienes alguna pregunta o encuentras algún problema, no dudes en contactarme.