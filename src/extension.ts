// TODO Comment Tracker Extension for VS Code

import * as vscode from "vscode";

// Step 1: Activation Function
export function activate(context: vscode.ExtensionContext) {
  // Register the TreeView
  const todoTreeDataProvider = new TodoTreeDataProvider();
  vscode.window.registerTreeDataProvider("todoTracker", todoTreeDataProvider);

  // Refresh the TreeView when manually triggered
  const disposable = vscode.commands.registerCommand(
    "todoTracker.findTodos",
    () => {
      vscode.window.showInformationMessage("Refreshing TODOs...");
      todoTreeDataProvider.refresh();
    }
  );

  context.subscriptions.push(disposable);
}

// Step 2: Deactivation Function
export function deactivate() {}

class TodoTreeDataProvider implements vscode.TreeDataProvider<TodoTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TodoTreeItem | undefined | void
  > = new vscode.EventEmitter<TodoTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TodoTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private todos: TodoTreeItem[] = [];

  constructor() {
    this.refresh();
    this.watchFilesForChanges();
  }

  private watchFilesForChanges() {
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.{js,ts,jsx,tsx,html,css}"
    );

    watcher.onDidChange(() => this.handleFileChange());
    watcher.onDidCreate(() => this.handleFileChange());
    watcher.onDidDelete(() => this.handleFileChange());
  }

  private handleFileChange() {
    this.refresh();
  }

  refresh(): void {
    this.todos = [];
    this.scanWorkspaceForTodos();
    this._onDidChangeTreeData.fire();
  }

  getChildren(element?: TodoTreeItem): Thenable<TodoTreeItem[]> {
    if (!element) {
      return Promise.resolve(this.todos);
    }
    return Promise.resolve([]);
  }

  getTreeItem(element: TodoTreeItem): vscode.TreeItem {
    return element;
  }

  private async scanWorkspaceForTodos() {
    if (!vscode.workspace.workspaceFolders) {
      vscode.window.showInformationMessage("No workspace folder found.");
      return;
    }

    const todoPattern = /\/\/\s*TODO:(.*)/g;

    await vscode.workspace
      .findFiles(
        "**/*.{js,ts,jsx,tsx,html,css}",
        "**/{node_modules,.git,dist,out}/**"
      )
      .then((files) => {
        files.forEach((file) => {
          vscode.workspace.openTextDocument(file).then((document) => {
            const text = document.getText();
            const lines = text.split("\n");
            lines.forEach((line, index) => {
              const match = todoPattern.exec(line);
              if (match) {
                this.todos.push(
                  new TodoTreeItem(
                    match[1].trim(),
                    `${document.fileName} - Line ${index + 1}`,
                    file,
                    index + 1
                  )
                );
              }
            });
          });
        });
      });

    this._onDidChangeTreeData.fire();
  }
}

class TodoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly resourceUri: vscode.Uri,
    private readonly lineNumber: number
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${this.label} - ${this.description}`;
    this.command = {
      command: "vscode.open",
      arguments: [this.resourceUri.with({ fragment: `L${this.lineNumber}` })],
      title: "Open TODO",
    };
  }
}
