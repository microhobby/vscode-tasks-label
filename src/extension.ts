import * as vscode from 'vscode';
import { TasksLabelCompletionProvider } from './TasksLabelCompletionProvider';
import { TasksLabelDefinitionProvider } from './TasksLabelDefinitionProvider';

// this should be the fastest extension ever done
export function activate(context: vscode.ExtensionContext) {
	const definitionProvider = new TasksLabelDefinitionProvider();
	const completionProvider =
		new TasksLabelCompletionProvider(definitionProvider);

	context.subscriptions.push(vscode.languages.registerDefinitionProvider(
		{ scheme: 'file', language: 'jsonc' },
		definitionProvider
	));

	context.subscriptions.push(vscode.languages.registerDefinitionProvider(
		{ scheme: 'file', language: 'json' },
		definitionProvider
	));

	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
			{ scheme: 'file', language: 'jsonc' },
			completionProvider,
			"\""
		)
	);
}

export function deactivate() {}
