const { google } = require('googleapis');

class GooglePeopleAPI {
    constructor(keyFilePath, scopes = ['https://www.googleapis.com/auth/contacts.readonly']) {
        this.auth = new google.auth.GoogleAuth({
            keyFile: './google.json',   // Ruta al archivo de clave de tu cuenta de servicio.
            scopes: scopes,  // Alcances para la API de contactos.
        });
        this.peopleService = google.people({
            version: 'v1',
            auth: this.auth
        });
    }

    /**
     * Inicializa el cliente de autenticación y configura la autenticación.
     * @returns {Promise<void>}
     */
    async initialize() {
        const authClient = await this.auth.getClient();
        google.options({ auth: authClient });
    }

    /**
     * Lista los contactos del usuario.
     * @returns {Array} - Lista de contactos.
     */
    async listContacts() {
        try {
            await this.initialize();

            const response = await this.peopleService.people.connections.list({
                resourceName: 'people/me',
                personFields: 'names,emailAddresses,phoneNumbers',  // Agregamos phoneNumbers para obtener teléfonos.
            });
            let miArreglo = [];
            const connections = response.data.connections;
            if (connections) {
                console.log('Lista de contactos:');
                connections.forEach((person) => {
                    let nombre='';
                    let email='';
                    let telefono='';
                    if (person.names && person.names.length > 0) {
                        console.log(`Nombre: ${person.names[0].displayName}`);
                        nombre=person.names[0].displayName
                    }
                    if (person.emailAddresses && person.emailAddresses.length > 0) {
                        console.log(`Email: ${person.emailAddresses[0].value}`);
                        email=person.emailAddresses[0].value
                    }
                    if (person.phoneNumbers && person.phoneNumbers.length > 0) {
                        console.log(`Teléfono: ${person.phoneNumbers[0].value}`);
                        telefono=person.phoneNumbers[0].value
                    }
                    miArreglo.push({nombre: nombre,email: email,telefono: telefono})
                });
            } else {
                console.log('No se encontraron contactos.');
            }
            return miArreglo;
        } catch (error) {
            console.error('Error al listar los contactos:', error);
            throw error;
        }
    }

    /**
     * Agrega un nuevo contacto a la lista de contactos del usuario.
     * @param {string} nombre - Nombre del contacto.
     * @param {string} email - Email del contacto.
     * @param {string} telefono - Número de teléfono del contacto.
     * @returns {Object} - Información del contacto creado.
     */
    async createContact(nombre, email, telefono) {
        try {
            await this.initialize();
            console.log('nombre: ',nombre)
            console.log('email: ',email)
            console.log('telefono: ',telefono)
            const newContact = {
                names: [{ givenName: nombre }],
                emailAddresses: [{ value: email }],
                phoneNumbers: [{ value: telefono }]  // Agregamos el número de teléfono.
            };

            const response = await this.peopleService.people.createContact({
                requestBody: newContact
            });

            console.log('Contacto creado con éxito:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error al crear contacto:', error);
            throw error;
        }
    }
}

module.exports = GooglePeopleAPI;
