import axios, { AxiosError, AxiosInstance } from "axios";
import core from "@actions/core";
import querystring from "querystring";
import { Sha256 } from "@aws-crypto/sha256-js";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { AWS_IDENTITY_DOCUMENT_URI, AWS_TOKEN_METADATA_URI } from "./constants";

const handleError = (err: unknown) => {
	if (err instanceof AxiosError) {
		core.error(err.response?.data?.message);
		if (typeof err?.response?.data === "object") {
			core.error(JSON.stringify(err?.response?.data, null, 4));
		}
	} else {
		core.error((err as Error)?.message);
	}
};

export const createAxiosInstance = (domain: string, defaultHeaders: Record<string, string>) => {
	const instance = axios.create({
		baseURL: domain,
		...(defaultHeaders && { headers: defaultHeaders })
	});

	return instance;
};

export const UALogin = async ({
	clientId,
	clientSecret,
	axiosInstance
}: {
	clientId: string;
	clientSecret: string;
	axiosInstance: AxiosInstance;
}) => {
	const loginData = querystring.stringify({
		clientId,
		clientSecret
	});

	try {
		const response = await axiosInstance({
			method: "post",
			url: "/api/v1/auth/universal-auth/login",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			data: loginData
		});

		return response.data.accessToken;
	} catch (err) {
		handleError(err);
		throw err;
	}
};

export const oidcLogin = async ({
	identityId,
	oidcAudience,
	axiosInstance
}: {
	identityId: string;
	oidcAudience: string;
	axiosInstance: AxiosInstance;
}) => {
	const idToken = await core.getIDToken(oidcAudience);

	const loginData = querystring.stringify({
		identityId,
		jwt: idToken
	});

	try {
		const response = await axiosInstance({
			method: "post",
			url: "/api/v1/auth/oidc-auth/login",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			data: loginData
		});

		return response.data.accessToken;
	} catch (err) {
		handleError(err);
		throw err;
	}
};

export const awsIamLogin = async ({ identityId, axiosInstance }: { identityId: string; axiosInstance: AxiosInstance }) => {
	try {
		// Get AWS region
		const region = await getAwsRegion();

		// Get AWS credentials
		const credentials = await fromNodeProviderChain()();

		if (!credentials.accessKeyId || !credentials.secretAccessKey) {
			throw new Error("AWS credentials not found");
		}

		// Create the AWS STS request
		const iamRequestURL = `https://sts.${region}.amazonaws.com/`;
		const iamRequestBody = "Action=GetCallerIdentity&Version=2011-06-15";
		const iamRequestHeaders = {
			"Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
			Host: `sts.${region}.amazonaws.com`
		};

		const request = new HttpRequest({
			protocol: "https:",
			hostname: `sts.${region}.amazonaws.com`,
			path: "/",
			method: "POST",
			headers: {
				...iamRequestHeaders,
				"Content-Length": String(Buffer.byteLength(iamRequestBody))
			},
			body: iamRequestBody
		});

		// Sign the request
		const signer = new SignatureV4({
			credentials,
			region,
			service: "sts",
			sha256: Sha256
		});

		const signedRequest = await signer.sign(request);

		// Extract headers as string record
		const headers: Record<string, string> = {};
		Object.entries(signedRequest.headers).forEach(([key, value]) => {
			if (typeof value === "string") {
				// Normalize Authorization header to proper case
				const normalizedKey = key.toLowerCase() === "authorization" ? "Authorization" : key;
				headers[normalizedKey] = value;
			}
		});

		// Send login request to Infisical
		const loginData = querystring.stringify({
			identityId,
			iamHttpRequestMethod: "POST",
			iamRequestBody: Buffer.from(iamRequestBody).toString("base64"),
			iamRequestHeaders: Buffer.from(JSON.stringify(headers)).toString("base64")
		});

		const response = await axiosInstance({
			method: "post",
			url: "/api/v1/auth/aws-auth/login",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			data: loginData
		});

		return response.data.accessToken;
	} catch (err) {
		handleError(err);
		throw err;
	}
};

const getAwsRegion = async () => {
	const region = process.env.AWS_REGION; // Typically found in lambda runtime environment
	if (region) {
		return region;
	}

	try {
		const tokenResponse = await axios.put(AWS_TOKEN_METADATA_URI, undefined, {
			headers: {
				"X-aws-ec2-metadata-token-ttl-seconds": "21600"
			},
			timeout: 5_000 // 5 seconds
		});

		const identityResponse = await axios.get(AWS_IDENTITY_DOCUMENT_URI, {
			headers: {
				"X-aws-ec2-metadata-token": tokenResponse.data,
				Accept: "application/json"
			},
			timeout: 5_000 // 5 seconds
		});

		return identityResponse.data.region;
	} catch (err) {
		handleError(err);
		throw err;
	}
};

export const getRawSecrets = async ({
	envSlug,
	infisicalToken,
	projectSlug,
	secretPath,
	shouldIncludeImports,
	shouldRecurse,
	axiosInstance
}: {
	envSlug: string;
	infisicalToken: string;
	projectSlug: string;
	secretPath: string;
	shouldIncludeImports: boolean;
	shouldRecurse: boolean;
	axiosInstance: AxiosInstance;
}) => {
	try {
		const response = await axiosInstance<{
			secrets: {
				secretKey: string;
				secretValue: string;
			}[];
			imports: {
				secrets: {
					secretKey: string;
					secretValue: string;
				}[];
			}[];
		}>({
			method: "get",
			url: "/api/v3/secrets/raw",
			headers: {
				Authorization: `Bearer ${infisicalToken}`
			},
			params: {
				secretPath,
				environment: envSlug,
				include_imports: shouldIncludeImports,
				recursive: shouldRecurse,
				workspaceSlug: projectSlug,
				expandSecretReferences: true
			}
		});

		const keyValueSecrets = Object.fromEntries(response.data.secrets.map(secret => [secret.secretKey, secret.secretValue]));

		// process imported secrets
		if (response.data.imports) {
			const imports = response.data.imports;
			for (let i = imports.length - 1; i >= 0; i--) {
				const importedSecrets = imports[i].secrets;
				importedSecrets.forEach(secret => {
					if (keyValueSecrets[secret.secretKey] === undefined) {
						keyValueSecrets[secret.secretKey] = secret.secretValue;
					}
				});
			}
		}

		return keyValueSecrets;
	} catch (err) {
		handleError(err);
		throw err;
	}
};
