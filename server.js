const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");

// En la nube usamos el puerto que nos den (process.env.PORT)
// En local usamos el 7000
const port = process.env.PORT || 7000;

serveHTTP(addonInterface, { port: port });
console.log(`Addon activo en el puerto: ${port}`);