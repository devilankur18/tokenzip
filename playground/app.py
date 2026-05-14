import streamlit as st
import re

st.set_page_config(page_title="TokenZip Playground", page_icon="🗜️", layout="wide")

st.title("🗜️ TokenZip Playground")
st.markdown("""
### See Semantic Compression in Action
TokenZip uses **Skeletonization** to prune implementation details while preserving the code's "Interface".
This allows AI agents to understand your codebase with **80%+ fewer tokens**.
""")

col1, col2 = st.columns(2)

DEFAULT_CODE = """import { McpServer } from "@modelcontextprotocol/sdk";
import { Surreal } from "surrealdb";

/**
 * The main engine for indexing the codebase.
 */
export class Indexer {
  private db: Surreal;

  constructor(db: Surreal) {
    this.db = db;
  }

  /**
   * Parses a file and extracts symbols.
   */
  async parseFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const tree = parser.parse(content);
    
    // Complex logic to traverse the tree
    // and extract relationships like 'calls', 'imports'
    // ... many lines of implementation ...
    console.log(`Processing ${filePath}`);
    await this.saveToGraph(tree.rootNode);
  }

  private async saveToGraph(node: any) {
    // Database interaction logic
    // ... implementation hidden ...
    await this.db.create('symbol', { type: node.type });
  }
}
"""

with col1:
    st.subheader("📄 Raw Source Code")
    code_input = st.text_area("Paste your TypeScript/JavaScript code here:", value=DEFAULT_CODE, height=400)
    raw_token_estimate = len(code_input.split()) * 1.3 # Very rough estimate
    st.info(f"Estimated Tokens: **{int(raw_token_estimate)}**")

def skeletonize(code):
    # Very simple regex-based skeletonization for the demo
    # Hides everything inside { } that follows a function/method signature
    lines = code.split('\n')
    skeleton = []
    in_function = False
    
    for line in lines:
        if any(keyword in line for keyword in ['async ', 'function ', 'method ', 'constructor', 'get ', 'set ']) and '{' in line:
            skeleton.append(line.split('{')[0] + '{ /* ... implementation hidden ... */ }')
            continue
        
        # Keep imports, classes, and exported constants
        if any(keyword in line for keyword in ['import ', 'export class', 'export const', 'interface ', 'type ']):
            skeleton.append(line)
        elif not line.strip():
            skeleton.append("")
            
    return "\n".join([l for l in skeleton if l.strip() or not l])

with col2:
    st.subheader("💀 TokenZip Skeleton")
    if st.button("Generate Skeleton ⚡"):
        skeleton_output = skeletonize(code_input)
        st.code(skeleton_output, language="typescript")
        
        skel_token_estimate = len(skeleton_output.split()) * 1.3
        savings = 100 - (skel_token_estimate / raw_token_estimate * 100)
        
        st.success(f"Estimated Tokens: **{int(skel_token_estimate)}**")
        st.metric("Token Savings", f"{int(savings)}%", delta=f"{int(savings)}% Less Bloat")
    else:
        st.info("Click the button to see the compressed output.")

st.markdown("---")
st.markdown("Ready to run this on your own repo? [Check out the Docs](https://github.com/ankur/tokenzip)")
