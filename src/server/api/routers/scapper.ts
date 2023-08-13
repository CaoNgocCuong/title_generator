// Libraries
import { Configuration, OpenAIApi } from "openai";
import puppeteer from "puppeteer";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

interface VideoData {
  title: string | null | undefined;
}

const configOpenAI = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openAI = new OpenAIApi(configOpenAI);
const URL = "https://www.youtube.com/";

export const scrapperRouter = createTRPCRouter({
  youtube: publicProcedure
    .input(
      z.object({
        alias: z.string(),
        title: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        /**
         * Step to scrapping title of the Youtube
         * 1. Open browser
         * 2. Navigate to Youtube channel
         * 3. Accept cookies
         * 4. Get all title with query selector all
         * 5. Push all title into my array
         */
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        const newURL = `${URL}${input.alias}`;
        await page.goto(newURL);

        const videoData: VideoData[] = await page.evaluate(() => {
          const eleVideoTitle = Array.from(
            document.querySelectorAll("#video-title")
          );

          const result = eleVideoTitle.map((each) => {
            const title = each.getAttribute("title");
            return { title };
          });

          return result;
        });

        // Close Puppeteer browser
        await browser.close();

        const titles: VideoData[] = videoData
          .filter((each) => each.title && typeof each.title === "string")
          .slice(0, 10); // Limit titles to last 10, not necessary but keeps OpenAI cost low

        // Prompt for AI
        const prompt = `The following is a list of youtube video title. After reading the titles, you are given a topic to then write a similar title for.\n\nTITLES: ${titles
          .map((item: VideoData) => item.title)
          .join(
            "\n"
          )}\n\nSIMILAR TITLE FOR TOPIC: "${input.title.toUpperCase()}"`;

        const res = await openAI.createCompletion({
          model: "text-davinci-003",
          prompt,
          temperature: 1,
          max_tokens: 256,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });

        return {
          status: res.status,
          statusText: res.statusText,
          data: res.data.choices[0]!.text ?? "Error generator title",
        };
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log("error :>", error);
      }
    }),
});
