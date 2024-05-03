import axios from "axios";
import querystring from "querystring";

export const UALogin = async ({ clientId, clientSecret, domain }) => {
  const loginData = querystring.stringify({
    clientId,
    clientSecret,
  });

  try {
    const response = await axios({
      method: "post",
      url: `${domain}/api/v1/auth/universal-auth/login`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: loginData,
    });
    return response.data.accessToken;
  } catch (err) {
    console.error("Error:", err.message);
    throw err;
  }
};

export const getRawSecrets = async ({
  domain,
  envSlug,
  infisicalToken,
  projectSlug,
  secretPath,
}) => {
  try {
    const response = await axios({
      method: "get",
      url: `${domain}/api/v3/secrets/raw`,
      headers: {
        Authorization: `Bearer ${infisicalToken}`,
      },
      params: {
        secretPath,
        environment: envSlug,
        include_imports: true,
        recursive: true,
        workspaceSlug: projectSlug,
      },
    });

    const keyValueSecrets = response.data.secrets.reduce(
      (accumulator, secret) => {
        accumulator[secret.secretKey] = secret.secretValue;
        return accumulator;
      },
      {}
    );

    // process imported secrets
    const imports = response.data.imports;
    for (let x = imports.length - 1; x >= 0; x--) {
      const importedSecrets = imports[x].secrets;
      importedSecrets.forEach((secret) => {
        if (keyValueSecrets[secret.secretKey] === undefined) {
          keyValueSecrets[secret.secretKey] = secret.secretValue;
        }
      });
    }

    return keyValueSecrets;
  } catch (err) {
    console.error("Error:", error.message);
    throw err;
  }
};
