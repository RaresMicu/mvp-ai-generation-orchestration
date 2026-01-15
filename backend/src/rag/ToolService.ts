import tools from "./toolRegistry.json";

export interface Tool {
    id: string;
    description: string;
    schema: any;
}

export class ToolService {
    static getAllTools(): Tool[] {
        return tools;
    }
}
