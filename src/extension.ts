'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { readdirSync, lstatSync, existsSync } from 'fs';
import { join, sep, dirname, normalize, isAbsolute } from "path";

/**
 * Compare-function to sort and group an array by folders and files
 * @param a File or folder
 * @param b File or folder
 */
function comp(a: string, b: string) {
    let compA = a;
    let compB = b;
    if (a.startsWith(".") && b.startsWith(".")) {
        compA = a.substr(1);
        compB = b.substr(1);
    } else if (a.startsWith(".")) {
        return -1;
    } else if (b.startsWith(".")) {
        return 1;
    }

    return compA.localeCompare(compB);
}

/**
 * Returns a list of files and folders of the passed path.
 * The results will by grouped by directories first and sorted alphabetically.
 * @param rootPath
 */
function getFilesAndFoldersFrom(rootPath: string): string[] {
    return readdirSync(rootPath).map((fileOrFolder) => {
        if (isDir(join(rootPath, fileOrFolder))) {
            return fileOrFolder + sep;
        } else {
            return fileOrFolder;
        }
    }).sort((a, b) => {
        const aIsDir = a.endsWith(sep);
        const bIsDir = b.endsWith(sep);
        if (aIsDir && bIsDir) {
            return comp(a, b);
        } else if (aIsDir) {
            return -1;
        } else if (bIsDir) {
            return 1;
        } else {
            return comp(a, b);
        }
    });
}

/**
 * Checks if the passed file path is a directory
 * @param filePath
 */
function isDir(filePath: string) {
    return lstatSync(filePath).isDirectory();
}

/**
 * Opens a quick pick dialog with the files and folders as selectable values
 * @param rootPath
 */
async function showQuickPickFrom(rootPath: string): Promise<string | undefined> {
    const paths = getFilesAndFoldersFrom(rootPath);
    paths.push(".." + sep); // allow to navigate backward

    let selectedItem = await vscode.window.showQuickPick(paths);
    if (selectedItem && selectedItem.endsWith(sep)) {
        selectedItem = selectedItem.substr(0, selectedItem.length - 1);
    }

    return selectedItem;
}

/**
 * Opens the passed file
 * @param filePath
 */
async function openFileFrom(filePath: string) {
    const textDocument = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(textDocument);
}


/**
 * Opens a quick pick for opening files.
 * The selectable values will be the files and folders relative to the passed root path
 * @param rootPath
 */
async function openFilePerQuickPick(rootPath: string) {
    let fileToOpen: string | undefined = rootPath;
    while (fileToOpen && isDir(fileToOpen)) {
        const selectedFile: string | undefined = await showQuickPickFrom(fileToOpen);
        if (selectedFile) {
            fileToOpen = normalize(join(fileToOpen, selectedFile));
        } else {
            // no file selected, user closed the input
            fileToOpen = selectedFile;
        }
    }

    if (fileToOpen) {
        await openFileFrom(fileToOpen);
    }
}

export function activate(context: vscode.ExtensionContext) {
    /**
     * This command opens a quick pick starting by the workspace root
     */
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.file-picker.openFileRelativeToWorkspace', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                await openFilePerQuickPick(workspaceFolders[0].uri.fsPath);
            } else {
                vscode.window.showErrorMessage("No workspace opened");
            }
        })
    );

    /**
     * This command opens a quick pick starting by the workspace root
     */
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.file-picker.openFileRelativeToOpenedFile', async () => {
            const activeTextEditor = vscode.window.activeTextEditor;
            if (activeTextEditor) {
                await openFilePerQuickPick(dirname(activeTextEditor.document.uri.fsPath));
            } else {
                vscode.window.showErrorMessage("No text editor opened");
            }
        })
    );

    /**
     * This command opens a file by path
     */
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.file-picker.openFileByPath', async () => {
            let filePath: string | undefined;
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let rootPath: string = "";
            if (workspaceFolders) {
                const activeTextEditor = vscode.window.activeTextEditor;
                rootPath = (activeTextEditor) ? dirname(activeTextEditor.document.uri.fsPath) : (workspaceFolders as vscode.WorkspaceFolder[])[0].uri.fsPath;
                filePath = await vscode.window.showInputBox({
                    ignoreFocusOut: true,
                    prompt: `Enter the file path (absolute or relative to '${rootPath}')`,
                    validateInput: (input) => {
                        var returnValue = "";

                        if (input) {
                            if (isAbsolute(input)) {
                                if (!existsSync(input)) {
                                    returnValue = "The file does not exist";
                                } else if (isDir(input)) {
                                    returnValue = "Please enter a file path, not a dir";
                                }
                            } else {
                                const filePath = normalize(join(rootPath, input));
                                if (!existsSync(filePath)) {
                                    returnValue = "The file does not exist";
                                } else if(isDir(filePath)) {
                                    returnValue = "Please enter a file path, not a dir";
                                }
                            }
                        }

                        return returnValue;
                    }
                });
            } else {
                filePath = await vscode.window.showInputBox({
                    ignoreFocusOut: true,
                    prompt: "Enter the file path (absolute)",
                    validateInput: (input) => {
                        var returnValue = "";

                        if (input) {
                            if (existsSync(input)) {
                                if (!isAbsolute(input)) {
                                    returnValue = "The file path has to be absolute";
                                } else if (isDir(input)) {
                                    returnValue = "Please enter a file path, not a dir";
                                }
                            } else {
                                returnValue = "The file does not exist";
                            }
                        }

                        return returnValue;
                    }
                });
            }

            if (filePath) {
                let fileToOpen = filePath;
                if (!isAbsolute(fileToOpen) && rootPath) {
                    fileToOpen = join(rootPath, filePath);
                }
                await openFileFrom(fileToOpen);
            }
        })
    );
}

// this method is called when your extension is deactivated
export function deactivate() {
}
