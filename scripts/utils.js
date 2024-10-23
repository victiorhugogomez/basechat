const { chat } = require('./chatgpt');
const { DateTime } = require('luxon');
let clientName=''

function validarCorreo(email) {
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}

function iso2text(iso) {
    try {
        const dateTime = DateTime.fromISO(iso, { zone: 'utc' }).setZone('Europe/London');
        const formattedDate = dateTime.toLocaleString({
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZoneName: 'short'
        });
        return formattedDate;
    } catch (error) {
        console.error('Error al convertir la fecha:', error);
        return 'Formato de fecha no válido';
    }
}

const convertToDate = (dateString) => {
    const [day, month, year] = dateString.split('/');
    return new Date(`${year}-${month}-${day}`);
};

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function isMorning(slot) {
    return slot.getHours() < 12;
}

function isAfternoon(slot) {
    return slot.getHours() >= 12;
}

function isFutureDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
}

// Función para esperar entre 1 y 2 segundos antes de responder
async function randomWait() {
    const delay = Math.random() * 1000 + 1000;  // Espera entre 1 y 2 segundos
    return new Promise(resolve => setTimeout(resolve, delay));
}
function formatHour(hour) {
    if (hour === 12) {
        return "12:00 PM";  // Las 12 se formatean como 12 PM
    } else if (hour === 0) {
        return "12:00 AM";  // Las 0 se formatean como 12 AM (medianoche)
    } else if (hour < 12) {
        return `${hour}:00 AM`;  // Para horas menores a las 12
    } else {
        return `${hour - 12}:00 PM`;  // Para horas mayores a las 12
    }
}

async function text2iso(text) {
    const currentDate = new Date();
    const prompt = "La fecha de hoy es: " + currentDate + `Te voy a dar un texto.
        Necesito que de ese texto extraigas la fecha y la hora del texto que te voy a dar y respondas con la misma en formato ISO. 
        Me tienes que responder EXCLUSIVAMENTE con esa fecha y horarios en formato ISO, usando el horario 10:00 en caso de que no este especificada la hora. 
        Por ejemplo, el texto puede ser algo como "el jueves 30 de mayo a las 12hs". En ese caso tu respuesta tiene que ser 2024-06-30T12:00:00.000. 
        Si el texto es algo como "Este viernes 31". En ese caso tu respuesta tiene que ser 2024-06-31T10:00:00.000. 
        Si el texto es algo como: Mañana 10am, sumarle un dia a la fecha actual y dar eso como resultado. 
        Si el texto no tiene sentido, responde 'false' `;
    const messages = [{ role: "user", content: `${text}` }];

    const response = await chat(prompt, messages);

    return response.trim();  
}

module.exports = { text2iso, iso2text, convertToDate, isMorning, isAfternoon, isValidDate, isFutureDate, validarCorreo, randomWait, clientName,formatHour };
