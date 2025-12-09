const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const parser = require("iptv-playlist-parser");
const manifest = require("./manifest.json");

const builder = new addonBuilder(manifest);

// URLs de las listas
const LISTAS_M3U = {
    "tv_iptv.org": "https://iptv-org.github.io/iptv/countries/es.m3u",
    "tv_freetv": "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_spain.m3u8",
    "tv_tdtchannels": "https://www.tdtchannels.com/lists/tv.m3u",
    "tv_elcano": "https://ipfs.io/ipns/k2k4r8oqlcjxsritt5mczkcn4mmvcmymbqw7113fz2flkrerfwfps004/data/listas/lista_fuera_iptv.m3u"
};

// --- FUNCIONES AUXILIARES ---

// Función para descargar y buscar un canal específico en todas las listas
// Esto es necesario para el MetaHandler
async function findChannelById(idBuscado) {
    for (const [key, url] of Object.entries(LISTAS_M3U)) {
        try {
            const response = await axios.get(url);
            const parsed = parser.parse(response.data);
            
            // Buscamos si algún canal de esta lista genera el mismo ID
            const canalEncontrado = parsed.items.find(canal => {
                const generatedId = "jopotv:" + Buffer.from(canal.url).toString('base64');
                return generatedId === idBuscado;
            });

            if (canalEncontrado) return canalEncontrado;
        } catch (e) {
            console.log("Error buscando en lista " + key);
        }
    }
    return null;
}

// --- HANDLERS ---

// 1. CATALOG HANDLER (El Menú)
builder.defineCatalogHandler(async ({ type, id }) => {
    console.log(`[CATALOG] Solicitud: ${id}`);
    if (type === "tv" && LISTAS_M3U[id]) {
        try {
            const response = await axios.get(LISTAS_M3U[id]);
            const parsed = parser.parse(response.data);

            const metas = parsed.items.map((canal) => {
                return {
                    id: "jopotv:" + Buffer.from(canal.url).toString('base64'),
                    type: "tv",
                    name: canal.name,
                    poster: canal.tvg.logo || "https://img.icons8.com/color/480/tv-show.png",
                    posterShape: "square",
                    description: `Canal: ${canal.name}`
                };
            });
            return { metas: metas.slice(0, 100) }; // Limite 100 para pruebas
        } catch (error) {
            return { metas: [] };
        }
    }
    return { metas: [] };
});

// 2. META HANDLER (Los Detalles)
builder.defineMetaHandler(async ({ type, id }) => {
    console.log(`[META] Solicitud de detalles para: ${id}`);
    
    if (type === "tv" && id.startsWith("jopotv:")) {
        const canal = await findChannelById(id);
        
        // Datos comunes para decirle a Stremio que esto es LIVE
        const comportamientoTV = {
            isLive: true,           // Indica que es en vivo
            defaultVideoId: id      // TRUCO: Le dice que el video por defecto es este mismo ID
        };

        if (canal) {
            return {
                meta: {
                    id: id,
                    type: "tv",
                    name: canal.name,
                    poster: canal.tvg.logo,
                    posterShape: "square",
                    background: canal.tvg.logo,
                    // Añadimos información extra para que parezca más pro
                    description: `🔴 EN VIVO: ${canal.name}\n\nOrigen: ${canal.group.title || "IPTV"}\nResolución: Automática`,
                    behaviorHints: comportamientoTV // Aquí va la magia
                }
            };
        }

        // Fallback si no encuentra info extra
        return {
            meta: {
                id: id,
                type: "tv",
                name: "Canal JopoTv",
                description: "Emisión en directo",
                behaviorHints: comportamientoTV
            }
        };
    }
    return Promise.resolve({ meta: null });
});

// 3. STREAM HANDLER (El Vídeo)
builder.defineStreamHandler(({ type, id }) => {
    console.log(`[STREAM] Solicitud de vídeo: ${id}`);
    if (type === "tv" && id.startsWith("jopotv:")) {
        const encodedUrl = id.split(":")[1];
        const streamUrl = Buffer.from(encodedUrl, 'base64').toString('ascii');
        
        return Promise.resolve({
            streams: [
                {
                    url: streamUrl,
                    title: "Emisión en Vivo (JopoTv)",
                    behaviorHints: {
                        notWebReady: true, // Aviso para Stremio Web
                        bingeGroup: "tv"
                    }
                }
            ]
        });
    }
    return Promise.resolve({ streams: [] });
});

module.exports = builder.getInterface();