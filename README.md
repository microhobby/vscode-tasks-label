
## Features

### Goto Definition

This extension allows you to jump to the definition of a label in the `tasks.json` file. It is useful when you have a large `tasks.json` file and you want to quickly jump to the definition of tasks from a `dependsOn` array. With `ctrl+click` on the label, you can jump to the definition of the task:

![demo](https://github.com/microhobby/vscode-tasks-label/blob/main/img/vscodetaskslabel.gif?raw=true)

### Completion

This extension also provides completion for the `dependsOn` and `preLaunchTask` properties in the `tasks.json` and `launch.json` files, respectively. The completion is based on the labels defined in the `tasks.json` file:

![demo](https://github.com/microhobby/vscode-tasks-label/blob/main/img/completion.gif?raw=true)

### Codelens References

This extension also provides a codelens to show the references of a label in the `tasks.json` file. It is useful when you want to know where a label is being used. The codelens is shown on the label definition:

![demo](https://github.com/microhobby/vscode-tasks-label/blob/main/img/showreferences.gif?raw=true)

### Diagnostics

This extension also provides a diagnostic for the labels used on `dependsOn` that are not defined. It is useful when you want to know if a label is not defined. The diagnostic is shown on the label used on `dependsOn`:

![demo](https://github.com/microhobby/vscode-tasks-label/blob/main/img/diagnostics.gif?raw=true)
