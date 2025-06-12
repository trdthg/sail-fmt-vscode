// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import path from 'path';

async function execWithStdin(command: string, inputData: string, options = {}): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const commandParts = command.split(' ');
		const child = spawn(commandParts[0], commandParts.slice(1), options);

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (data) => {
			stdout += data.toString();
		});
		child.stderr.on('data', (data) => {
			stderr += data.toString();
		});
		child.on('close', (code) => {
			if (code === 0) {
				resolve({ stdout, stderr });
			} else {
				const error = new Error(`exec faied, code: ${code}`);
				reject(error);
			}
		});

		child.on('error', (err) => {
			reject(err);
		});

		if (inputData) {
			child.stdin.write(inputData);
			child.stdin.end();
		}
	});
}

function getUpdateRange(document: vscode.TextDocument, n: string) {
	const fullRange = new vscode.Range(
		document.lineAt(0).range.start,
		document.lineAt(document.lineCount - 1).range.end
	);
	return [vscode.TextEdit.replace(fullRange, n)];
}

async function formatDocument(document: vscode.TextDocument) {
	const filePath = document.fileName;
	try {
		// prepare variables
		const sailfmtconfig = vscode.workspace.getConfiguration('sailFormatter')

		// get sail executable path from config
		const sailPath = sailfmtconfig.get('path', 'sail');

		// get sail-config.json path from config
		let sailConfigFilePath: string = sailfmtconfig.get('sail_config', "");
		if (sailConfigFilePath === "") {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			const fileWorkspaceFolder = workspaceFolders?.find(
				(folder) => filePath.startsWith(folder.uri.fsPath)
			);
			const defaultConfigFileName = "sail_config.json";
			sailConfigFilePath = fileWorkspaceFolder
				? path.join(fileWorkspaceFolder.uri.fsPath, defaultConfigFileName)
				: "";
		}
		let sail_config_option = sailConfigFilePath != "" ? ` --sail_config ${sailConfigFilePath}` : "";

		// get format command
		const command = `${sailPath}${sail_config_option} --fmt-emit stdout -fmt`;
		console.log(`Executing command: ${command}`);

		// run format command
		const { stdout, stderr } = await execWithStdin(command, document.getText(), { timeout: 10000 }); // 设置超时时间

		const formattedText = stdout;

		// handle error
		if (stderr) {
			const msg = `Sail format failed: ${stderr}`
			console.warn(msg);
			vscode.window.showWarningMessage(msg);
		}

		if (formattedText === document.getText()) {
			console.log("File no update");
			return [];
		}

		// get update range
		return getUpdateRange(document, formattedText);
	} catch (error: any) {
		console.error(`Error executing sail -fmt: ${error.message}`);
		vscode.window.showErrorMessage(`Failed to format with Sail: ${error.message}`);
		return [];
	}
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "sail-fmt" is now active!');

	let disposable = vscode.languages.registerDocumentFormattingEditProvider(
		{ scheme: 'file', language: 'sail' },
		{
			provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.ProviderResult<vscode.TextEdit[]> {
				return formatDocument(document);
			}
		}
	);

	context.subscriptions.push(disposable);

}

// This method is called when your extension is deactivated
export function deactivate() { }
