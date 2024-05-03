import core from "@actions/core";
import { UALogin, getRawSecrets } from "./infisical.js";
import fs from "fs/promises";

try {
  const UAClientId = core.getInput("client-id");
  const UAClientSecret = core.getInput("client-secret");
  const domain = core.getInput("domain");
  const envSlug = core.getInput("env-slug");
  const projectSlug = core.getInput("project-slug");
  const secretPath = core.getInput("secret-path");
  const exportType = core.getInput("export-type");
  const fileOutputPath = core.getInput("file-output-path");

  // get infisical token using UA credentials
  const infisicalToken = await UALogin({
    domain,
    clientId: UAClientId,
    clientSecret: UAClientSecret,
  });

  console.log("INFISICAL TOKEN", infisicalToken);

  // get secrets from Infisical using input params
  const keyValueSecrets = await getRawSecrets({
    domain,
    envSlug,
    infisicalToken,
    projectSlug,
    secretPath,
  });

  console.log("KEY VALUE SECRETS", keyValueSecrets);

  // export fetched secrets
  if (exportType === "env") {
    // Write the secrets to action ENV
    Object.entries(keyValueSecrets).forEach(([key, value]) => {
      //   core.setSecret(value);
      core.exportVariable(key, value);
    });
    core.info("Injected secrets as environment variables");
  } else if (exportType === "file") {
    // Write the secrets to a .env file at the specified path
    const envContent = Object.keys(keyValueSecrets)
      .map((key) => `${key}='${keyValueSecrets[key]}'`)
      .join("\n");

    try {
      core.info(`Exporting secrets as .env file to path ${fileOutputPath}`);
      await fs.writeFile(`${fileOutputPath}.env`, envContent);
    } catch (err) {
      core.error(`Error writing .env file: ${err}`);
      throw err;
    }
    core.info("Successfully exported to .env file");
  }
} catch (error) {
  core.setFailed(error.message);
}
