import * as vscode from 'vscode';
import { TasksLabelCompletionProvider } from './TasksLabelCompletionProvider';
import { TasksLabelDefinitionProvider } from './TasksLabelDefinitionProvider';

export function activate(context: vscode.ExtensionContext) {
	const definitionProvider =
		new TasksLabelDefinitionProvider();
	const completionProvider =
		new TasksLabelCompletionProvider(definitionProvider);

	context.subscriptions.push(
		...definitionProvider.regDisposables,
		...completionProvider.regDisposables
	);
}

export function deactivate() {}
