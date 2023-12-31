# app-server-express-v1
_Final proyect of Coderhouse_

# Servidor API REST - Express.js Node.js

# Indice

- [Descripción](#descripción)
- [Características principales](#características-principales)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Uso](#uso)

### Descripción
_Este es un servidor API REST basado en el framework Express.js, desarrollado con JavaScript en el entorno de desarrollo Node.js. El servidor sigue una arquitectura por capas y utiliza MongoDB como base de datos, utilizando el driver Mongoose para interactuar con la misma._

### Características principales

- Ofrece servicios para gestionar Usuarios, Productos y Carrito de compra para cada usuario.
- Envío de correos electrónicos y mensajes SMS.
- Métodos de autenticación basados en Passport y JWT con signedCookies y cookieParser.
- Validaciones de datos utilizando express-validator.
- Sistema de log utilizando Winston.
- Clusterización del servidor para distribuir procesos en los núcleos del hardware.
- Configuración de variables de entorno con dotenv, commander y el archivo .env.
- Contenedor Docker para facilitar el despliegue del servidor.

### Requisitos previos

_Asegúrate de tener instalado lo siguiente:_

- Node.js (versión 18.17.0)
- MongoDB (versión 5.6.0)

### Instalación

1. Clona este repositorio en tu máquina local.

   By HTTPS:
   
   `git clone https://github.com/<username>/app-server-express-v1.git`
   
3. En la raíz del proyecto, ejecuta el siguiente comando para instalar las dependencias:

   `npm install`

4. Crea un archivo .env en la raíz del proyecto y configura las siguientes variables de entorno:
   
    * NODE_ENV <environment>
    * PERSISTENCE <type_of_persistence>
    * PORT <number_of_port>
    * MONGO_CNX_STR <mongo_connection_string>
    * JWT_PRIVATE_KEY <jwt_private_key>
    * SECRET_WORD <secret_word_for_signed_cookies>
    * ADMIN_EMAIL <email_of_administrator>
    * ADMIN_PASSWORD <password_of_administrator>
    * USER_NODEMAILER <user_nodemailer>
    * PASS_NODEMAILER <password_nodemailer>
    * ACCOUNT_SID_TWILIO <account_id_twilio>
    * AUTH_TOKEN_TWILIO <token_twilio>
    * PHONE_NUMBER_TWILIO <phone_number_of_twilio>
    * HARDCODED_EMAIL <email>
    * DOMAIN <domain>
  
5. Inicia el servidor ejecutando el siguiente comando:

   `npm start`

   _Esto iniciará el servidor en modo de producción._

### Uso

_Una vez que el servidor esté en funcionamiento, podrás acceder a los diferentes endpoints de la API para gestionar Usuarios y productos (si eres usuario Admin), ver productos, agregarlos al carrito de compras (si eres usuario Premium o User). Puedes consultar la documentación de la API para obtener más detalles sobre cómo interactuar con los diferentes endpoints._
