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
  const shouldIncludeImports = core.getBooleanInput("should-include-imports");
  const shouldRecurse = core.getBooleanInput("should-recurse");

  // get infisical token using UA credentials
  const infisicalToken = await UALogin({
    domain,
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
    shouldIncludeImports,
    shouldRecurse,
  });

  core.info(
    `Exporting the following envs", ${JSON.stringify(
      Object.keys(keyValueSecrets)
    )}`
  );

  // export fetched secrets
  if (exportType === "env") {
    // Write the secrets to action ENV
    Object.entries(keyValueSecrets).forEach(([key, value]) => {
      core.setSecret(value);
      core.exportVariable(key, value);
    });
    core.info("Injected secrets as environment variables");
  } else if (exportType === "file") {
    // Write the secrets to a .env file at the specified path
    const envContent = Object.keys(keyValueSecrets)
      .map((key) => `${key}='${keyValueSecrets[key]}'`)
      .join("\n");

    try {
      const filePath = `${fileOutputPath}.env`;
      core.info(`Exporting secrets to ${filePath}`);
      await fs.writeFile(filePath, envContent);
    } catch (err) {
      core.error(`Error writing .env file: ${err.message}`);
      throw err;
    }
    core.info("Successfully exported secrets to .env file");
  }
} catch (error) {
  core.setFailed(error.message);
}
