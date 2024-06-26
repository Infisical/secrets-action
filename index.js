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
  const shouldIncludeImports = core.getBooleanInput("include-imports");
  const shouldRecurse = core.getBooleanInput("recursive");

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

  core.debug(
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
    // Write the secrets to a file at the specified path
    const fileContent = Object.keys(keyValueSecrets)
      .map((key) => `${key}='${keyValueSecrets[key]}'`)
      .join("\n");

    try {
      const filePath = `${process.env.GITHUB_WORKSPACE}${fileOutputPath}`;
      core.info(`Exporting secrets to ${filePath}`);
      await fs.writeFile(filePath, fileContent);
    } catch (err) {
      core.error(`Error writing file: ${err.message}`);
      throw err;
    }
    core.info("Successfully exported secrets to file");
  }
} catch (error) {
  core.setFailed(error.message);
}
