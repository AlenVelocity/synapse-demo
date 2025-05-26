'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { forwardRef, useImperativeHandle, useEffect } from 'react'
import Mathematics from '@/lib/extensions/mathematics'
import 'katex/dist/katex.min.css'

interface MarkdownEditorProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	className?: string
}

export interface MarkdownEditorRef {
	focus: () => void
	getMarkdown: () => string
	setMarkdown: (markdown: string) => void
}

const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
	({ value, onChange, placeholder = "Your text will appear here...", className }, ref) => {
		const editor = useEditor({
			extensions: [
				StarterKit.configure({
					// Disable the default code block to avoid conflicts
					codeBlock: false,
				}),
				Markdown.configure({
					html: false, // Disable HTML for security
					tightLists: true,
					bulletListMarker: '-',
					linkify: true,
					breaks: true,
					transformPastedText: true,
					transformCopiedText: false,
				}),
				Mathematics.configure({
					katexOptions: {
						throwOnError: false,
						errorColor: '#cc0000',
						maxSize: 300,
					},
				}),
			],
			content: value,
			editorProps: {
				attributes: {
					class: className || 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] max-h-[50vh] overflow-y-auto p-4 text-lg',
					'data-placeholder': placeholder,
				},
			},
			onUpdate: ({ editor }) => {
				const markdown = editor.storage.markdown.getMarkdown()
				onChange(markdown)
			},
		})

		// Update editor content when value prop changes (but avoid infinite loops)
		useEffect(() => {
			if (editor && value !== editor.storage.markdown.getMarkdown()) {
				editor.commands.setContent(value)
			}
		}, [editor, value])

		useImperativeHandle(ref, () => ({
			focus: () => {
				editor?.commands.focus()
			},
			getMarkdown: () => {
				return editor?.storage.markdown.getMarkdown() || ''
			},
			setMarkdown: (markdown: string) => {
				editor?.commands.setContent(markdown)
			},
		}))

		if (!editor) {
			return null
		}

		return (
			<div className="relative">
				<EditorContent editor={editor} />
				<style jsx global>{`
					.ProseMirror p.is-editor-empty:first-child::before {
						content: attr(data-placeholder);
						float: left;
						color: #adb5bd;
						pointer-events: none;
						height: 0;
					}
					.ProseMirror {
						outline: none;
					}
					.ProseMirror h1 {
						font-size: 1.5em;
						font-weight: bold;
						margin: 0.5em 0;
					}
					.ProseMirror h2 {
						font-size: 1.3em;
						font-weight: bold;
						margin: 0.5em 0;
					}
					.ProseMirror h3 {
						font-size: 1.1em;
						font-weight: bold;
						margin: 0.5em 0;
					}
					.ProseMirror ul, .ProseMirror ol {
						padding-left: 1.5em;
						margin: 0.5em 0;
					}
					.ProseMirror li {
						margin: 0.25em 0;
					}
					.ProseMirror blockquote {
						border-left: 3px solid #ddd;
						padding-left: 1em;
						margin: 1em 0;
						font-style: italic;
					}
					.ProseMirror code {
						background-color: #f1f3f4;
						padding: 0.2em 0.4em;
						border-radius: 3px;
						font-family: 'Courier New', monospace;
					}
					.ProseMirror strong {
						font-weight: bold;
					}
					.ProseMirror em {
						font-style: italic;
					}
					/* Mathematics extension styles */
					.Tiptap-mathematics-render {
						display: inline-block;
						margin: 0 2px;
						vertical-align: middle;
					}
					.Tiptap-mathematics-editor {
						background-color: #f8f9fa;
						border: 1px solid #e9ecef;
						border-radius: 3px;
						padding: 2px 4px;
						font-family: 'Courier New', monospace;
						font-size: 0.9em;
					}
					.Tiptap-mathematics-error {
						background-color: #ffebee;
						color: #c62828;
						padding: 2px 4px;
						border-radius: 3px;
						border: 1px solid #ffcdd2;
					}
				`}</style>
			</div>
		)
	}
)

MarkdownEditor.displayName = 'MarkdownEditor'

export default MarkdownEditor 