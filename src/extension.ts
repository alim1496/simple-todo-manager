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

  todoTreeDataProvider.refresh();
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
    });
  }

  getChildren(element?: TodoTreeItem): Thenable<TodoTreeItem[]> {
    if (!element) {
      return Promise.resolve(this.todos);
    }
    return Promise.resolve(element.children);
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

    const fileToTodosMap: Map<string, TodoTreeItem[]> = new Map();
    let totalTodoCount = 0;

    const todoPromises = files.map(async (file) => {
      const document = await vscode.workspace.openTextDocument(file);
      const text = document.getText();
      const lines = text.split("\n");
      const todos: TodoTreeItem[] = [];

      lines.forEach((line, index) => {
        todoPattern.lastIndex = 0;
        const match = todoPattern.exec(line);
        if (match) {
          todos.push(
            new TodoTreeItem(
              match[1].trim(),
              `${document.fileName} - Line ${index + 1}`,
              file,
              index + 1
            )
          );
          totalTodoCount++;
        }
      });

      if (todos.length > 0) {
        fileToTodosMap.set(file.fsPath, todos);
      }
    });

    await Promise.all(todoPromises);

    this.todos = Array.from(fileToTodosMap.entries()).map(
      ([filePath, todos]) => {
        const fileName = vscode.workspace.asRelativePath(filePath);
        return new TodoTreeItem(
          fileName,
          `${todos.length}`,
          undefined,
          null,
          todos
        );
      }
    );

    this._onDidChangeTodoCount.fire(totalTodoCount);
  }
}

class TodoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly resourceUri: vscode.Uri | undefined = undefined,
    public readonly lineNumber: number | null = null,
    public readonly children: TodoTreeItem[] = []
  ) {
    super(
      label,
      children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.tooltip = this.lineNumber
      ? `${this.label} - Line ${this.lineNumber}`
      : this.label;

    if (this.resourceUri && this.lineNumber !== null) {
      this.command = {
        command: "vscode.open",
        arguments: [this.resourceUri.with({ fragment: `L${this.lineNumber}` })],
        title: "Open TODO",
      };
    }
  }
}
