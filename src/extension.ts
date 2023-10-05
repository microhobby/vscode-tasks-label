import * as vscode from 'vscode';
import * as fs from 'fs';
import * as Path from 'path';

interface Task {
	label: string;
	line: number;
}

function _isIncludeFile(fileName: string): boolean {
	const _includeFiles = 
		vscode
			.workspace
				.getConfiguration("tasksLabel")
					.get("includeFiles") as string[];

	for (let index = 0; index < _includeFiles.length; index++) {
		const includeFile = _includeFiles[index];
		if (fileName.endsWith(includeFile)) {
			return true;
		}
	}

	return false;
}

export function provideDefinition(
	document: vscode.TextDocument, 
	position: vscode.Position, 
	token: vscode.CancellationToken
): vscode.ProviderResult<vscode.DefinitionLink[]> {
	if (
		document.fileName.endsWith('tasks.json') ||
		document.fileName.endsWith('launch.json') ||
		_isIncludeFile(document.fileName)
	) {
		// read the file
		let text = document.getText();
		let path = document.uri.fsPath;
		
		// we have to get the string inside the quotes
		let range = document.getWordRangeAtPosition(position);
		let word = document.getText(range);

		while(!(word.startsWith('"') && word.endsWith('"'))) {
			range = new vscode.Range(
				(word.startsWith('"') ? range!.start : range!.start.translate(0, -1)), 
				(word.endsWith('"') ? range!.end : range!.end.translate(0, 1))
			);
			word = document.getText(range);
		}

		word = word.replace(/"/g, '');

		// pass trough the files
		const files = Array<{
			path: string,
			content: string
		}>();
		const _includeFiles = 
			vscode
				.workspace
					.getConfiguration("tasksLabel")
						.get("includeFiles") as string[];
		_includeFiles.push(".vscode/tasks.json");

		// read the files
		for (let index = 0; index < _includeFiles.length; index++) {
			const includeFile = _includeFiles[index];
			// if (document.fileName.endsWith(includeFile)) {
			// 	continue;
			// }

			// FIXME: this will not work for multi-root workspaces
			path = Path.join(vscode.workspace.rootPath!, includeFile);
			text = fs.readFileSync(path, 'utf8');

			files.push({
				"path": path,
				"content": text
			});
		}

		// pass trough the lines
		// if (document.fileName.endsWith('launch.json')) {
		// 	// read the tasks.json
		// 	path = document.uri.fsPath
		// 		.replace('launch.json', 'tasks.json');
		// 	text = fs.readFileSync(path, 'utf8');
		// }

		// for each file content
		for (const fileContent of files) {
			const lines = fileContent.content.split(/\r?\n/g);
			const lPath = fileContent.path;

			for (let index = 0; index < lines.length; index++) {
				const line = lines[index];
				const match = line.match(/"label":\s*"(.*)"/);
				if (match) {
					const task: Task = {
						label: match[1],
						line: index
					};

					if (task.label === word) {
						return [{
							targetUri: vscode.Uri.file(lPath),
							targetRange: new vscode.Range(
								task.line, 0, 
								task.line, 0
							),
							originSelectionRange: range
						}];
					}
				}
			}
		}
	}

	return undefined;
}

// this should be the fastest extension ever done
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerDefinitionProvider(
		{ scheme: 'file', language: 'jsonc' },
		{
			provideDefinition: provideDefinition
		}
	));

	context.subscriptions.push(vscode.languages.registerDefinitionProvider(
		{ scheme: 'file', language: 'json' },
		{
			provideDefinition: provideDefinition
		}
	));
}

export function deactivate() {}
