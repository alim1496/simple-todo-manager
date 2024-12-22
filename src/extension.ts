// TODO Comment Tracker Extension for VS Code

import * as vscode from "vscode";

// Step 1: Activation Function
export function activate(context: vscode.ExtensionContext) {
  // Register the TreeView
  const todoTreeDataProvider = new TodoTreeDataProvider();
  const treeView = vscode.window.createTreeView("todoTracker", {
    treeDataProvider: todoTreeDataProvider,
  });

  // Update the badge when TODOs are refreshed
  todoTreeDataProvider.onDidChangeTodoCount((count) => {
    treeView.badge = {
      value: count,
      tooltip: `${count} TODO(s) found`,
    };
  });

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

  private _onDidChangeTodoCount: vscode.EventEmitter<number> =
    new vscode.EventEmitter<number>();
  readonly onDidChangeTodoCount: vscode.Event<number> =
    this._onDidChangeTodoCount.event;

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
    this.scanWorkspaceForTodos().then(() => {
      this._onDidChangeTreeData.fire();
      this._onDidChangeTodoCount.fire(this.todos.length);
    });
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

    const todoPattern = /\/\/\s*TODO:(.*)/;

    const files = await vscode.workspace.findFiles(
      "**/*.{js,ts,jsx,tsx,html,css}",
      "**/{node_modules,.git,dist,out}/**"
    );

    const todoPromises = files.map(async (file) => {
      const document = await vscode.workspace.openTextDocument(file);
      const text = document.getText();
      const lines = text.split("\n");

      lines.forEach((line, index) => {
        todoPattern.lastIndex = 0; // Reset regex state
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

    await Promise.all(todoPromises); // Wait for all files to be processed
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
