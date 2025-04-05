import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { isReactToVideoToolArgs, REACT_TO_VIDEO_TOOL, reactToVideoTool } from "./react2video.js";

const server = new Server(
  {
    name: "react-video-mcp-server",
    version: "0.0.1",
  },
  {
    capabilities: {
      resources: {},
      tools: {}
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [REACT_TO_VIDEO_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    switch (name) {
      case REACT_TO_VIDEO_TOOL.name:
        if (!isReactToVideoToolArgs(args)) {
          throw new Error('Invalid arguments for react_code_to_video');
        }
        
        const videoPath = await reactToVideoTool(args);
        return { result: videoPath };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
