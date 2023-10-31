import * as vscode from 'vscode';
import { TasksLabelDefinitionProvider } from './TasksLabelDefinitionProvider';

export class TasksLabelCompletionProvider
implements vscode.CompletionItemProvider
{
	regDisposables: vscode.Disposable[] = [];
	private _definition: TasksLabelDefinitionProvider;

	constructor (definition: TasksLabelDefinitionProvider) {
		this._definition = definition;

		this.regDisposables.push(
			vscode.languages.registerCompletionItemProvider(
				{ scheme: 'file', language: 'jsonc' },
				this,
				"\""
			));
	}

	private _expectedDependsOn (
		document: vscode.TextDocument,
		position: vscode.Position
	): boolean {
		let line = position.line;
		let linePrefix =
            document.lineAt(position).text.substring(0, position.character);

		// steps that need to be true
		// I'm in a beginnig of an string?
		if (
			!linePrefix.endsWith("\"") && !linePrefix.endsWith("'")
		) {
			return false;
		}

		// I'm in a dependsOn property string value
		if (
			!linePrefix.endsWith("\"dependsOn\": \"")
		) {
			// I'm in a dependsOn property array of strings?
			while (line >= 0) {
				line--;
				linePrefix = document.lineAt(line).text;

				if (
					!linePrefix.endsWith(",\"") &&
                    !linePrefix.endsWith(",'") &&
                    !linePrefix.endsWith(", \"") &&
                    !linePrefix.endsWith(", '") &&
                    !linePrefix.endsWith(",") ||
                    linePrefix.includes("[")
				) {
					if (linePrefix.includes("\"dependsOn\":")) {
						break;
					} else if (!linePrefix.includes("[")) {
						return false;
					}
				}
			}
		}

		return true;
	}

	private _expectedPreLaunchTask (
		document: vscode.TextDocument,
		position: vscode.Position
	): boolean {
		let line = position.line;
		let linePrefix =
            document.lineAt(position).text.substring(0, position.character);

		// steps that need to be true
		// I'm in a beginnig of an string?
		if (
			!linePrefix.endsWith("\"") && !linePrefix.endsWith("'")
		) {
			return false;
		}

		// I'm in a preLaunchTask property string value
		if (
			!linePrefix.endsWith("\"preLaunchTask\": \"")
		) {
			// I'm in a preLaunchTask property array of strings?
			while (line >= 0) {
				line--;
				linePrefix = document.lineAt(line).text;

				// preLaunchTask can not be an array
				if (linePrefix.includes("\"preLaunchTask\":")) {
					break;
				} else {
					return false;
				}
			}
		}

		return true;
	}

	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext
	): vscode.ProviderResult<
        vscode.CompletionList<vscode.CompletionItem> | vscode.CompletionItem[]
    >
	{
		if (
			!this._expectedDependsOn(document, position) &&
            !this._expectedPreLaunchTask(document, position)
		) {
			return undefined;
		}

		const items = Array<vscode.CompletionItem>();
		const definitions = this._definition.getDefinedTasks();

		for (const def of definitions) {
			const item = new vscode.CompletionItem(def);
			item.kind = vscode.CompletionItemKind.Method;
			items.push(item);
		}

		return items;
	}
}
