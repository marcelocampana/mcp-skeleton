import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create the MCP server
const server = new McpServer({
  name: "skeleton-manager",
  version: "1.0.0",
});

server.tool(
  "ping",
  "Ping the skeleton server to check if it is running",
  { message: z.string().describe("Your Message") },
  async ({ message }) => {
    try {
      return {
        content: [
          { type: "text", text: `Server was pinged with the following message => ${message}` },
        ],
      };
    } catch (error) {
      console.error("Error in ping tool:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

let currentSpaceId = process.env.STORYBLOK_SPACE_ID;
let storyblokRegion: "eu" | "us" | "ap" | "ca" | "cn" | undefined = undefined; // Región detectada o forzada

function detectRegionFromSpaceId(spaceId: string): "eu" | "us" | "ap" | "ca" | "cn" {
  if (/^10\d+/.test(spaceId)) return "us";
  // Puedes agregar más reglas aquí si Storyblok publica los patrones para otras regiones
  return "eu"; // Por defecto EU
}

function getStoryblokApiBase() {
  const region = storyblokRegion || (currentSpaceId ? detectRegionFromSpaceId(currentSpaceId) : "eu");
  switch (region) {
    case "us":
      return "https://api-us.storyblok.com/v1";
    case "ap":
      return "https://api-ap.storyblok.com/v2";
    case "ca":
      return "https://api-ca.storyblok.com/v2";
    case "cn":
      return "https://app.storyblokchina.cn";
    case "eu":
    default:
      return "https://mapi.storyblok.com/v1";
  }
}

server.tool(
  "set-region",
  "Permite establecer manualmente la región del servidor de Storyblok (eu, us, ap, ca, cn). Si no se usa, la región se detecta automáticamente por el ID del espacio.",
  { region: z.enum(["eu", "us", "ap", "ca", "cn"]).describe("Región: 'eu', 'us', 'ap', 'ca', 'cn'") },
  async ({ region }) => {
    storyblokRegion = region;
    return {
      content: [
        {
          type: "text",
          text: `La región de Storyblok ha sido actualizada manualmente a: ${storyblokRegion}`,
        },
      ],
    };
  }
);

server.tool(
  "fetch-stories",
  "Fetches stories from Storyblok",
  {},
  async ({}) => {
    try {
      const response = await fetch(
        `${getStoryblokApiBase()}/spaces/${currentSpaceId}/stories/`,
        {
          headers: {
            Authorization: `${process.env.STORYBLOK_MANAGEMENT_TOKEN}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch stories: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error in story fetch tool:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

server.tool(
  "fetch-components",
  "Obtiene los componentes del espacio en Storyblok",
  {},
  async ({}) => {
    try {
      const response = await fetch(
        `${getStoryblokApiBase()}/spaces/${currentSpaceId}/components/`,
        {
          headers: {
            Authorization: `${process.env.STORYBLOK_MANAGEMENT_TOKEN}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`No se pudieron obtener los componentes: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error en la tool fetch-components:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

server.tool(
  "fetch-assets",
  "Obtiene los activos (imágenes y archivos) del espacio en Storyblok, incluyendo nombre, archivo, peso, alt, carpeta, etiquetas y más.",
  {},
  async ({}) => {
    try {
      const response = await fetch(
        `${getStoryblokApiBase()}/spaces/${currentSpaceId}/assets/`,
        {
          headers: {
            Authorization: `${process.env.STORYBLOK_MANAGEMENT_TOKEN}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`No se pudieron obtener los activos: ${response.statusText}`);
      }
      const data = await response.json();
      const assets = (data.assets || []).map((asset: any) => ({
        id: asset.id,
        filename: asset.filename,
        name: asset.name,
        size_bytes: asset.size,
        size_mb: asset.size ? (asset.size / (1024 * 1024)).toFixed(2) : null,
        alt: asset.alt,
        folder: asset.asset_folder_id,
        tags: asset.asset_tags,
        created_at: asset.created_at,
        updated_at: asset.updated_at,
        copyright: asset.copyright,
        content_type: asset.content_type,
        // Otros campos si lo deseas
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(assets, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error en la tool fetch-assets:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

server.tool(
  "set-space-id",
  "Permite establecer el ID del espacio de Storyblok a consultar. La región se detecta automáticamente salvo que se haya forzado manualmente.",
  { spaceId: z.string().describe("Nuevo ID del espacio de Storyblok") },
  async ({ spaceId }) => {
    currentSpaceId = spaceId;
    // Si la región fue forzada manualmente, no la cambiamos
    if (!storyblokRegion) {
      // Se detecta automáticamente la región
      const region = detectRegionFromSpaceId(spaceId);
      storyblokRegion = undefined; // Para que getStoryblokApiBase use la detección automática
      return {
        content: [
          {
            type: "text",
            text: `El ID del espacio ha sido actualizado a: ${currentSpaceId}. Región detectada: ${region}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `El ID del espacio ha sido actualizado a: ${currentSpaceId}. Región manual: ${storyblokRegion}`,
        },
      ],
    };
  }
);

// server.tool(
//   "fetch-seo-info",
//   "Busca y retorna información SEO (título de página, meta descripción, etc.) de las historias de Storyblok.",
//   {},
//   async ({}) => {
//     try {
//       const response = await fetch(
//         `https://mapi.storyblok.com/v1/spaces/${currentSpaceId}/stories/`,
//         {
//           headers: {
//             Authorization: `${process.env.STORYBLOK_MANAGEMENT_TOKEN}`,
//           },
//         }
//       );
//       if (!response.ok) {
//         throw new Error(`No se pudieron obtener las historias: ${response.statusText}`);
//       }
//       const data = await response.json();
//       // Extraer información SEO de cada historia
//       const seoInfo = (data.stories || []).map((story: any) => {
//         // Ajusta las rutas según la estructura de tus historias y campos SEO
//         const content = story.content || {};
//         return {
//           id: story.id,
//           name: story.name,
//           slug: story.slug,
//           page_title: content.seo_title || content.title || "",
//           meta_description: content.seo_description || content.description || "",
//           // Puedes agregar más campos SEO si existen en tu espacio
//         };
//       });
//       return {
//         content: [
//           {
//             type: "text",
//             text: JSON.stringify(seoInfo, null, 2),
//           },
//         ],
//       };
//     } catch (error) {
//       console.error("Error en la tool fetch-seo-info:", error);
//       return {
//         isError: true,
//         content: [
//           {
//             type: "text",
//             text: `Error: ${
//               error instanceof Error ? error.message : String(error)
//             }`,
//           },
//         ],
//       };
//     }
//   }
// );

server.tool(
  "search-content",
  "Permite buscar cualquier término dentro del contenido de las historias de Storyblok.",
  { query: z.string().describe("Término a buscar en el contenido de las historias") },
  async ({ query }) => {
    try {
      const response = await fetch(
        `${getStoryblokApiBase()}/spaces/${currentSpaceId}/stories/`,
        {
          headers: {
            Authorization: `${process.env.STORYBLOK_MANAGEMENT_TOKEN}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`No se pudieron obtener las historias: ${response.statusText}`);
      }
      const data = await response.json();
      // Buscar el término en cualquier campo de cada historia
      const results = (data.stories || []).filter((story: any) => {
        const contentStr = JSON.stringify(story);
        return contentStr.toLowerCase().includes(query.toLowerCase());
      });
      return {
        content: [
          {
            type: "text",
            text: results.length
              ? JSON.stringify(results, null, 2)
              : `No se encontraron resultados para: "${query}"`,
          },
        ],
      };
    } catch (error) {
      console.error("Error en la tool search-content:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

server.tool(
  "fetch-story-by-id",
  "Recupera el contenido completo de una historia específica por su ID, incluyendo todos sus campos.",
  { storyId: z.string().describe("ID de la historia a recuperar") },
  async ({ storyId }) => {
    try {
      const response = await fetch(
        `${getStoryblokApiBase()}/spaces/${currentSpaceId}/stories/${storyId}`,
        {
          headers: {
            Authorization: `${process.env.STORYBLOK_MANAGEMENT_TOKEN}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`No se pudo obtener la historia: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error en la tool fetch-story-by-id:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP server is running");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

main();
