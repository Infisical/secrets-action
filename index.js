import core from "@actions/core";
import { UALogin, getRawSecrets } from "./infisical.js";
import fs from "fs/promises";

try {
  const UAClientId = core.getInput("client-id");
  console.log("UA CLIENT ID IS", UAClientId);
  const UAClientSecret = core.getInput("client-secret");
  const domain = core.getInput("domain");
  const envSlug = core.getInput("env-slug");
  const projectSlug = core.getInput("project-slug");
  const secretPath = core.getInput("secret-path");
  const exportType = core.getInput("export-type");
  const fileOutputPath = core.getInput("file-output-path");

  // get infisical token using UA credentials
  const infisicalToken = await UALogin({
    clientId: UAClientId,
    clientSecret: UAClientSecret,
  });

  // get secrets from Infisical using input params
  const keyValueSecrets = await getRawSecrets({
    domain,
    envSlug,
    infisicalToken,
    projectSlug,
    secretPath,
  });

  // export fetched secrets
  if (exportType === "env") {
    // Write the secrets to action ENV
    keyValueSecrets.entries(([key, value]) => {
      core.setSecret(value);
      core.exportVariable(key, value);
    });
    core.info("Injected secrets as environment variables");
  } else if (exportType === "file") {
    // Write the secrets to a .env file at the specified path
    const envContent = Object.keys(keyValueSecrets)
      .map((key) => `${key}=${obj[key]}`)
      .join("\n");

    try {
      await fs.writeFile(fileOutputPath, envContent);
    } catch (err) {
      core.error(`Error writing .env file: ${err}`);
      throw err;
    }
    core.info(`.env file was saved successfully to ${fileOutputPath}`);
  }
} catch (error) {
  core.setFailed(error.message);
}
