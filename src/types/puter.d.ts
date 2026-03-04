// Type declarations for Puter.js (loaded via <script src="https://js.puter.com/v2/">)
interface PuterAI {
  txt2img(
    prompt: string,
    options?: {
      model?: string;
      input_image?: string;
      input_image_mime_type?: string;
      width?: number;
      height?: number;
      steps?: number;
      seed?: number;
      negative_prompt?: string;
      quality?: string;
    },
  ): Promise<HTMLImageElement>;
}

interface Puter {
  ai: PuterAI;
}

declare const puter: Puter;
