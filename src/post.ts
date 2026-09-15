import core from "@actions/core";
import fs from "fs/promises";

const post = async () => {
	try {
		const fileOutputPath = core.getInput("file-output-path");
		const shouldClean = core.getBooleanInput("clean");

		if (shouldClean) {
			try {
				const filePath = `${process.env.GITHUB_WORKSPACE}${fileOutputPath}`;
				
				try {
					await fs.access(filePath);
					await fs.unlink(filePath);
					core.info(`Cleaned up exported file at ${filePath}`);
				} catch (accessErr) {
					core.debug(`File not found at ${filePath}, skipping cleanup`);
				}
			} catch (err) {
				core.warning(`Failed to clean up file: ${(err as Error)?.message}`);
			}
		} else {
			core.info("Cleanup is disabled, keeping exported file");
		}
	} catch (err) {
		core.setFailed((err as Error)?.message);
	}
};

post();
