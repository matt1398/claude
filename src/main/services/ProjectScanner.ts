/**
 * ProjectScanner service - Scans ~/.claude/projects/ directory and lists all projects.
 *
 * Responsibilities:
 * - Read project directories from ~/.claude/projects/
 * - Decode directory names to original paths
 * - Count session files for each project
 * - Determine last accessed time from file modifications
 * - Return sorted list of projects
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Project } from '../../renderer/types/data';
import { decodePath, isValidEncodedPath } from '../utils/pathDecoder';

export class ProjectScanner {
  private readonly projectsDir: string;

  constructor(projectsDir?: string) {
    // Default to ~/.claude/projects/
    this.projectsDir = projectsDir || path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * Scans the projects directory and returns a list of all projects.
   * @returns Promise that resolves to an array of projects, sorted by last accessed (most recent first)
   */
  async scan(): Promise<Project[]> {
    try {
      // Check if projects directory exists
      if (!fs.existsSync(this.projectsDir)) {
        console.warn(`Projects directory does not exist: ${this.projectsDir}`);
        return [];
      }

      // Read all directories in projects folder
      const entries = fs.readdirSync(this.projectsDir, { withFileTypes: true });

      // Filter to only directories with valid encoding pattern
      const projectDirs = entries.filter(
        entry => entry.isDirectory() && isValidEncodedPath(entry.name)
      );

      // Process each project directory
      const projects = await Promise.all(
        projectDirs.map(dir => this.scanProject(dir.name))
      );

      // Filter out any null results (failed scans)
      const validProjects = projects.filter((p): p is Project => p !== null);

      // Sort by last accessed (most recent first)
      validProjects.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());

      return validProjects;
    } catch (error) {
      console.error('Error scanning projects directory:', error);
      return [];
    }
  }

  /**
   * Scans a single project directory and returns project metadata.
   * @param encodedName - The encoded directory name
   * @returns Promise that resolves to a Project object, or null if scan fails
   */
  private async scanProject(encodedName: string): Promise<Project | null> {
    try {
      const projectPath = path.join(this.projectsDir, encodedName);
      const decodedName = decodePath(encodedName);

      // Get all files in the project directory
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });

      // Count .jsonl files at the root (these are sessions)
      const sessionFiles = entries.filter(
        entry => entry.isFile() && entry.name.endsWith('.jsonl')
      );

      const sessionCount = sessionFiles.length;

      // Find the most recent file modification time
      let lastAccessed = new Date(0); // Default to epoch

      for (const file of sessionFiles) {
        const filePath = path.join(projectPath, file.name);
        const stats = fs.statSync(filePath);

        if (stats.mtime > lastAccessed) {
          lastAccessed = stats.mtime;
        }
      }

      // If no session files, use directory mtime
      if (sessionFiles.length === 0) {
        const stats = fs.statSync(projectPath);
        lastAccessed = stats.mtime;
      }

      return {
        id: encodedName,
        name: decodedName,
        path: projectPath,
        lastAccessed,
        sessionCount,
      };
    } catch (error) {
      console.error(`Error scanning project ${encodedName}:`, error);
      return null;
    }
  }

  /**
   * Gets details for a specific project by ID.
   * @param projectId - The encoded project directory name
   * @returns Promise that resolves to a Project object, or null if not found
   */
  async getProject(projectId: string): Promise<Project | null> {
    const projectPath = path.join(this.projectsDir, projectId);

    if (!fs.existsSync(projectPath)) {
      return null;
    }

    return this.scanProject(projectId);
  }

  /**
   * Lists all session files for a given project.
   * @param projectId - The encoded project directory name
   * @returns Promise that resolves to an array of session file paths (absolute paths)
   */
  async listSessionFiles(projectId: string): Promise<string[]> {
    try {
      const projectPath = path.join(this.projectsDir, projectId);

      if (!fs.existsSync(projectPath)) {
        return [];
      }

      const entries = fs.readdirSync(projectPath, { withFileTypes: true });

      // Filter to .jsonl files only (at root level)
      const sessionFiles = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.jsonl'))
        .map(entry => path.join(projectPath, entry.name));

      return sessionFiles;
    } catch (error) {
      console.error(`Error listing session files for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Checks if a project has a subagents directory.
   * @param projectId - The encoded project directory name
   * @param sessionId - The session UUID
   * @returns Promise that resolves to true if subagents directory exists
   */
  async hasSubagents(projectId: string, sessionId: string): Promise<boolean> {
    const subagentsPath = path.join(
      this.projectsDir,
      projectId,
      sessionId,
      'subagents'
    );

    return fs.existsSync(subagentsPath);
  }

  /**
   * Gets the path to the session file.
   * @param projectId - The encoded project directory name
   * @param sessionId - The session UUID
   * @returns The absolute path to the session JSONL file
   */
  getSessionPath(projectId: string, sessionId: string): string {
    return path.join(this.projectsDir, projectId, `${sessionId}.jsonl`);
  }

  /**
   * Gets the path to the subagents directory.
   * @param projectId - The encoded project directory name
   * @param sessionId - The session UUID
   * @returns The absolute path to the subagents directory
   */
  getSubagentsPath(projectId: string, sessionId: string): string {
    return path.join(this.projectsDir, projectId, sessionId, 'subagents');
  }
}
