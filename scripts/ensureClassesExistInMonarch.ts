import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tsPlugin } from '@sveltejs/acorn-typescript';
import { Parser } from 'acorn';

type AstNode = { type: string; [key: string]: unknown };

const CSS_CLASS_SELECTOR = /\.((?:\\.|[\w-])+)/g;
const MARKER_CLASSES = /^(group|peer)(\/[\w-]+)?$/;
const CLASS_TOKEN = /^-?[a-z@[(*!][^\s"'`]*[-:\]][^\s"'`]*$/;
// biome-ignore format: reads better as one line
const SINGLE_WORD_UTILITIES = new Set(["flex", "grid", "block", "inline", "hidden", "contents", "relative", "absolute", "fixed", "sticky", "truncate", "grow", "shrink", "border", "rounded", "underline", "italic", "uppercase", "invisible", "visible"]);
const TS_PARSER = Parser.extend(tsPlugin());
const TSX_PARSER = Parser.extend(tsPlugin({ jsx: true }));
const TYPE_KEYS = new Set(['typeAnnotation', 'typeParameters', 'typeArguments', 'returnType']);

async function main(): Promise<void> {
	const monarchClassNames = await getMonarchClassNames();
	const missing = getSourceClassNames().difference(monarchClassNames);

	if (missing.size) {
		console.log([...missing].sort().join('\n'));
		console.log("\nThese classes have no CSS on Monarch's pages. Use one Monarch uses, or an inline style.");
		process.exitCode = 1;
	} else {
		console.log(`Every class Wingspan uses is in Monarch's stylesheet (${monarchClassNames.size} classes).`);
	}
}

async function getMonarchClassNames(): Promise<Set<string>> {
	const indexHtml = await (await fetch('https://app.monarch.com/')).text();
	const stylesheetUrls = [...indexHtml.matchAll(/https:\/\/static\.monarch\.com\/static\/css\/[\w.]+\.css/g)].map(match => match[0]);
	if (!stylesheetUrls.length) throw new Error(`No stylesheet found from https://app.monarch.com/`);

	const classNames = new Set<string>();
	for (const stylesheetUrl of stylesheetUrls) {
		const stylesheetText = await (await fetch(stylesheetUrl)).text();

		for (const match of stylesheetText.matchAll(CSS_CLASS_SELECTOR)) classNames.add(match[1]?.replace(/\\(.)/g, '$1') ?? '');
	}

	return classNames;
}

function getSourceClassNames(): Set<string> {
	const classNames = new Set<string>();

	for (const path of readdirSync('src', { recursive: true, encoding: 'utf8' })) {
		if (!/\.tsx?$/.test(path)) continue;

		for (const text of getClassStrings(join('src', path))) {
			for (const token of text.split(/\s+/)) {
				if ((CLASS_TOKEN.test(token) || SINGLE_WORD_UTILITIES.has(token)) && !MARKER_CLASSES.test(token)) classNames.add(token);
			}
		}
	}

	return classNames;
}

function getClassStrings(path: string): string[] {
	const parser = path.endsWith('.tsx') ? TSX_PARSER : TS_PARSER;
	const programNode = parser.parse(readFileSync(path, 'utf8'), { sourceType: 'module', ecmaVersion: 'latest', locations: true }) as unknown as AstNode;

	if (path === 'src/monarch/ui/styles.ts') {
		const statements = (programNode.body as AstNode[]).filter(statement => statement.type !== 'ImportDeclaration' && !declares(statement, 'TW_MERGE_CONFIG'));
		return statements.flatMap(getStrings);
	}

	const strings: string[] = [];
	visit(programNode, node => {
		if (node.type === 'JSXAttribute' && (node.name as AstNode).name === 'className') strings.push(...getStrings(node.value));
		if (node.type === 'Property' && getPropertyName(node) === 'className') strings.push(...getStrings(node.value));
		if (node.type === 'CallExpression' && (node.callee as AstNode).type === 'Identifier' && (node.callee as AstNode).name === 'classNames') {
			strings.push(...getStrings(node.arguments));
		}
	});

	return strings;
}

function getStrings(node: unknown): string[] {
	const strings: string[] = [];
	visit(node, child => {
		if (child.type === 'Literal' && typeof child.value === 'string') strings.push(child.value);
		if (child.type === 'TemplateElement') strings.push((child.value as { cooked?: string }).cooked ?? '');
		if (child.type === 'Property' && !child.computed) {
			strings.push(...getStrings(child.value));
			return false;
		}
	});
	return strings;
}

function visit(node: unknown, onNode: (node: AstNode) => boolean | undefined): void {
	if (Array.isArray(node)) {
		for (const child of node) visit(child, onNode);

		return;
	}

	if (!isAstNode(node) || onNode(node) === false) return;
	for (const [key, child] of Object.entries(node)) if (!TYPE_KEYS.has(key)) visit(child, onNode);
}

function isAstNode(value: unknown): value is AstNode {
	return typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';
}

function getPropertyName(property: AstNode): unknown {
	const key = property.key as AstNode;
	return property.computed ? undefined : (key.name ?? key.value);
}

function declares(statement: AstNode, name: string): boolean {
	return statement.type === 'VariableDeclaration' && (statement.declarations as AstNode[]).some(declarator => (declarator.id as AstNode).name === name);
}

await main();
