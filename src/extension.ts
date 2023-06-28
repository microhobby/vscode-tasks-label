import * as vscode from 'vscode';
import * as fs from 'fs';

interface Task {
	label: string;
	line: number;
}

export function provideDefinition(
	document: vscode.TextDocument, 
	position: vscode.Position, 
	token: vscode.CancellationToken
): vscode.ProviderResult<vscode.DefinitionLink[]> {
	if (
		document.fileName.endsWith('tasks.json') ||
		document.fileName.endsWith('launch.json')
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

		// pass trough the lines
		if (document.fileName.endsWith('launch.json')) {
			// read the tasks.json
			path = document.uri.fsPath
				.replace('launch.json', 'tasks.json');
			text = fs.readFileSync(path, 'utf8');
		}

		const lines = text.split(/\r?\n/g);
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
						targetUri: vscode.Uri.file(path),
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

	return undefined;
}

// this should be the fastest extension ever done
export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.languages.registerDefinitionProvider(
		{ scheme: 'file', language: 'jsonc' },
		{
			provideDefinition: provideDefinition
		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate() {}
