"use strict";

const { get } = require("axios");

class Handler {
  constructor({ rekoSvc, translatorSvc }) {
    this.rekoSvc = rekoSvc;
    this.translatorSvc = translatorSvc;
  }

  async detectImageLabels(buffer) {
    const result = await this.rekoSvc
      .detectLabels({
        Image: {
          Bytes: buffer,
        },
      })
      .promise();

    const workingItems = result.Labels.filter(
      ({ Confidence }) => Confidence > 88
    );

    const names = workingItems.map(({ Name }) => Name).join(" and ");

    return { names, workingItems };
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: "en",
      TargetLanguageCode: "pt",
      Text: text,
    };

    const { TranslatedText } = await this.translatorSvc
      .translateText(params)
      .promise();

    return TranslatedText.split(" e ");
  }

  formatTextResults(texts, workingItems) {
    const finalText = texts.reduce((acc, text, index) => {
      const nameInPortuguese = text;
      const confidence = workingItems[index].Confidence;
      const phrase = `${confidence.toFixed(
        2
      )}% de ser do tipo ${nameInPortuguese}`;

      return [...acc, phrase];
    }, []);

    return finalText.join("\n");
  }

  async getImageBuffer(imageUrl) {
    const { data } = await get(imageUrl, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(data, "base64");

    return buffer;
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters;
      // const imgBuffer = await readFile("./images/cat.jpeg");
      console.log("Downloading image...");
      const buffer = await this.getImageBuffer(imageUrl);

      console.log("Detecting labels...");

      // const { names, workingItems } = await this.detectImageLabels(imgBuffer);
      const { names, workingItems } = await this.detectImageLabels(buffer);

      console.log("Translate to Portuguese...");
      const texts = await this.translateText(names);

      console.log("Handling final object...");
      const finalText = this.formatTextResults(texts, workingItems);

      return {
        statusCode: 200,
        body: `BRENO GARCIA - Identificação de imagens...\n\nA imagem tem:\n\n`.concat(
          finalText
        ),
      };
    } catch (error) {
      console.log("ERROR: ", error.stack);
      return {
        statusCode: 500,
        body: "Internal server error!",
      };
    }
  }
}

//factory
const aws = require("aws-sdk");
const reko = new aws.Rekognition();
const translator = new aws.Translate();
const handler = new Handler({ rekoSvc: reko, translatorSvc: translator });

module.exports.main = handler.main.bind(handler);
