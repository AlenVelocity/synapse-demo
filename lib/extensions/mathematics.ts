import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import katex from 'katex'

export interface MathematicsOptions {
  regex: RegExp
  katexOptions?: any
  shouldRender?: (state: any, pos: number, node: any) => boolean
}

export const defaultShouldRender = (state: any, pos: number, node: any) => {
  const $pos = state.doc.resolve(pos)
  return node.type.name === 'text' && $pos.parent.type.name !== 'codeBlock'
}

export const Mathematics = Extension.create<MathematicsOptions>({
  name: 'mathematics',

  addOptions() {
    return {
      regex: /\$([^\$]*)\$/gi,
      katexOptions: {
        throwOnError: false,
        errorColor: '#cc0000',
      },
      shouldRender: defaultShouldRender,
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    
    return [
      new Plugin({
        key: new PluginKey('mathematics'),
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, decorationSet) {
            const { doc } = tr
            const decorations: Decoration[] = []

            doc.descendants((node, pos) => {
              if (node.isText && options.shouldRender?.(tr, pos, node)) {
                const text = node.text || ''
                let match
                const regex = new RegExp(options.regex.source, options.regex.flags)
                
                while ((match = regex.exec(text)) !== null) {
                  const start = pos + match.index
                  const end = start + match[0].length
                  const mathContent = match[1]

                  if (mathContent.trim()) {
                    try {
                      const rendered = katex.renderToString(mathContent, options.katexOptions)
                      
                      const decoration = Decoration.widget(start, () => {
                        const container = document.createElement('span')
                        container.className = 'Tiptap-mathematics-render'
                        container.innerHTML = rendered
                        container.style.display = 'inline-block'
                        container.style.margin = '0 2px'
                        return container
                      }, {
                        side: 1,
                        marks: [],
                      })

                      decorations.push(decoration)

                      // Hide the original text
                      const hideDecoration = Decoration.inline(start, end, {
                        class: 'Tiptap-mathematics-editor',
                        style: 'display: none;'
                      })
                      decorations.push(hideDecoration)
                    } catch (error) {
                      console.warn('KaTeX rendering error:', error)
                      // Show error decoration
                      const errorDecoration = Decoration.inline(start, end, {
                        class: 'Tiptap-mathematics-error',
                        style: 'background-color: #ffebee; color: #c62828; padding: 2px 4px; border-radius: 3px;'
                      })
                      decorations.push(errorDecoration)
                    }
                  }
                }
              }
            })

            return DecorationSet.create(doc, decorations)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

export default Mathematics 