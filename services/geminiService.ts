import { GoogleGenAI, Type } from "@google/genai";
import { MindMapNode, LogicDiagramData } from '../types';

const generateMindMapData = async (ai: GoogleGenAI, topic: string, documentContent?: string): Promise<MindMapNode> => {
  let prompt = `You are a helpful assistant that generates structured data for mind maps.`;

  if (documentContent) {
    if (topic.trim()) {
      prompt += `\nBased on the following document, create a mind map focusing on: "${topic}".`;
    } else {
      prompt += `\nCreate a mind map summarizing the key points of the following document.`;
    }
    prompt += `\n\n--- DOCUMENT START ---\n${documentContent}\n--- DOCUMENT END ---`;
  } else {
    // If the topic is very long, instruct the model to summarize it for the root node.
    if (topic.length > 150) {
        prompt += `\nAnalyze the following problem or statement: "${topic}".`;
        prompt += `\nFirst, identify the core subject or question. Then, create a mind map that breaks down the problem or explores its key concepts.`;
        prompt += `\nThe root node of the mind map must have a concise name that summarizes the core subject, not the full text provided.`;
    } else {
        prompt += `\nCreate a mind map for the topic: "${topic}".`;
    }
  }

  prompt += `
The output must be a valid JSON object.
The JSON object should have a single root key named 'root'.
The value of 'root' should be an object with a required 'name' key (a string with the central topic) and an optional 'children' key (an array of node objects).
Each node object in the 'children' array must also have a required 'name' and an optional 'children' key.
The nesting can go up to 3 levels deep. Do not include any text or explanations outside of the JSON object.`;

  const mindMapSchema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      children: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            children: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  children: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                      },
                      required: ['name']
                    }
                  }
                },
                required: ['name']
              }
            }
          },
          required: ['name']
        }
      }
    },
    required: ['name']
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          root: mindMapSchema,
        },
        required: ['root'],
      },
      temperature: 0.2,
    },
  });

  const jsonText = response.text;
  const parsed = JSON.parse(jsonText);

  if (parsed && parsed.root) {
    return parsed.root as MindMapNode;
  } else {
    throw new Error("Invalid JSON structure for mind map received from API.");
  }
};

const generateLogicDiagramData = async (ai: GoogleGenAI, topic: string, documentContent?: string): Promise<LogicDiagramData | null> => {
  let prompt = `You are an expert at identifying logical flows, procedures, or formulas in text and converting them into a structured logic diagram (flowchart) format.`;

  const content = documentContent ? `this document:\n\n${documentContent}` : `the topic: "${topic}"`;
  
  prompt += `\n\nAnalyze ${content}. Identify the single most prominent procedure, algorithm, or logical sequence.`;
  
  if(topic.trim() && documentContent) {
    prompt += `\nYour analysis should focus specifically on "${topic}".`;
  }

  prompt += `\n\nIf you find a clear logical sequence, represent it as a JSON object with 'nodes' and 'links'.
- 'nodes' should be an array of objects, each with a unique 'id' (string), a 'label' (string), and an optional 'shape' ('rect' for process, 'diamond' for decision, 'ellipse' for start/end).
- 'links' should be an array of objects, each with a 'source' (the id of the starting node), a 'target' (the id of the ending node), and an optional 'label' (e.g., 'Yes' or 'No' for decisions).

If no clear logical sequence, procedure, or formula is present, return a JSON object with empty arrays for 'nodes' and 'links'. Do not invent a process.
The output must be a valid JSON object only.`;

  const logicDiagramSchema = {
    type: Type.OBJECT,
    properties: {
      nodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Unique identifier for the node" },
            label: { type: Type.STRING, description: "Text to display in the node" },
            shape: { type: Type.STRING, enum: ['rect', 'diamond', 'ellipse'], description: "Shape of the node" },
          },
          required: ['id', 'label'],
        }
      },
      links: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            source: { type: Type.STRING, description: "ID of the source node" },
            target: { type: Type.STRING, description: "ID of the target node" },
            label: { type: Type.STRING, description: "Label for the link (e.g., Yes/No)" },
          },
          required: ['source', 'target'],
        }
      }
    },
    required: ['nodes', 'links'],
  };

  try {
     const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: logicDiagramSchema,
        temperature: 0.1,
      },
    });

    const jsonText = response.text;
    const parsed = JSON.parse(jsonText) as LogicDiagramData;
    
    if (parsed && parsed.nodes && parsed.nodes.length > 0) {
      return parsed;
    }
    
    return null; // No diagram generated or it was empty
  } catch (error) {
    console.warn("Could not generate logic diagram:", error);
    return null; // Non-critical, so we don't throw
  }
};


export const generateVisualizations = async (topic: string, documentContent?: string): Promise<{ mindMapData: MindMapNode, logicDiagramData: LogicDiagramData | null }> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const [mindMapData, logicDiagramData] = await Promise.all([
      generateMindMapData(ai, topic, documentContent),
      generateLogicDiagramData(ai, topic, documentContent),
    ]);

    return { mindMapData, logicDiagramData };

  } catch (error) {
    console.error("Error generating visualizations:", error);
    if (error instanceof Error) {
       throw new Error(`Failed to generate visualizations: ${error.message}`);
    }
    throw new Error("An unknown error occurred during generation.");
  }
};