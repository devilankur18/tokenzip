# 🏠 Running TokenZip with Local LLMs

TokenZip is designed to be model-agnostic. While it works great with Claude and GPT-4, it is exceptionally powerful for **Local LLMs** (Ollama, LM Studio) where context windows might be smaller or compute is limited.

## 🛠️ Setup with Ollama

1.  **Install Ollama**: Follow the instructions at [ollama.ai](https://ollama.ai).
2.  **Pull a strong coding model**:
    ```bash
    ollama pull qwen2.5-coder:32b # Highly recommended
    # OR
    ollama pull codellama:13b
    ```

3.  **Run TokenZip MCP Server**:
    Since MCP is a standard, you can point your local MCP client to TokenZip.

### Using with Claude Desktop (Connected to Local LLM)
If you use the Claude Desktop app but want it to use TokenZip context while chatting with a local model (via a bridge), the setup remains the same.

### Using with CLI Agents (e.g., Aider, OpenDevin)
Most local-first agents support MCP or direct CLI interaction.

## 🚀 Why TokenZip is Mandatory for Local LLMs

1.  **Context Window Limits**: Many local models are optimized for 8k-32k context. Standard `file_read` can fill this in seconds. TokenZip's `smart_file_read` keeps your context lean.
2.  **Reduced Hallucinations**: Local models often hallucinate signatures when they haven't seen the whole file. TokenZip provides the **Skeleton**, which gives them the exact signatures they need to be accurate.
3.  **Faster Inference**: Fewer tokens = faster response times. By saving 80% on tokens, you get significantly faster iterations on local hardware.

## 🔗 Pointing to Local Instances

If you are running TokenZip on one machine and your LLM on another, you can expose the MCP server over a tunnel (like `ngrok`) or use a network-mounted drive for the `.tokenzip` database.

```bash
# Start the server on all interfaces (advanced)
tokenzip serve --port 3000
```
