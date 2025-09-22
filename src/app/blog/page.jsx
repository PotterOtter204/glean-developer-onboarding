import React from 'react'

const BlogPage = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 font-sans leading-relaxed text-gray-800">
      <article className="bg-white rounded-lg shadow-md overflow-hidden">
        <header className="px-8 pt-8 pb-4 border-b border-gray-200">
          <h1 className="text-4xl font-bold text-slate-700 leading-tight">
            Building a Developer Onboarding Chat - In an afternoon
          </h1>
        </header>

        <div className="p-8">
          <p className="mb-6 text-gray-600">
            No set of documentation, even the most comprehensive, can cover every use case.
            A chatbot with built-in knowledge of your product and documentation can help cover the gaps.
            Whether it's an inexperienced developer, one with a niche tech stack, or someone on a tight deadline,
            you can help them get the exact information they need. Asking a question and getting a personalized
            answer is becoming the default paradigm for information retrieval. To demonstrate how simple and
            affordable this can be, I made a chatbot for the Glean documentation.
          </p>

          <section className="mb-8">
            <h2 className="text-3xl font-semibold text-slate-600 mt-10 mb-4 border-b-2 border-gray-100 pb-2">
              Building a search index
            </h2>
            <p className="mb-6 text-gray-600">
              The first step was to create a set of metadata that the LLM could easily filter and use to find
              the correct pages to load when answering user questions.
            </p>

            <p className="mb-6 text-gray-600">To create the metadata, I wrote a Python script to fetch, summarize, and categorize the doc pages. Here's how it works:</p>

            <ul className="mb-6 pl-6 text-gray-600">
              <li className="mb-2">Fetch the Glean documentation home page to create an initial list of links to crawl and a starting list of categories to enable filtering of the pages</li>
              <li className="mb-2">Crawl the list of links one by one, fetching each page</li>
              <li className="mb-2">Get all the links on the page using Beautiful Soup and add the new links to the list of pages to fetch</li>
              <li className="mb-2">Get the main content area of the page and, using an LLM, create:
                <ul className="mt-2 pl-6">
                  <li className="mb-1">A 2-3 sentence summary of the page content</li>
                  <li className="mb-1">A list of categories the page content fits in (with the option to add 1 new one if no existing categories cover the current page content)</li>
                </ul>
              </li>
            </ul>

            <p className="mb-6 text-gray-600">Once this process was complete, I had a list of 34 topics (e.g. authentication, web-sdk, client-api) and 203 unique pages.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-3xl font-semibold text-slate-600 mt-10 mb-4 border-b-2 border-gray-100 pb-2">
              Building the agentic chat
            </h2>
            <p className="mb-6 text-gray-600">
              Using Next.js, I built a chat app with the OpenAI TypeScript package using OpenRouter to easily
              switch between models. To fetch the necessary information, the agent would need tools it could use.
            </p>

            <h3 className="text-xl font-semibold text-slate-600 mt-8 mb-4">Agent Tools</h3>
            <ul className="mb-6 pl-6 text-gray-600">
              <li className="mb-2"><strong className="text-slate-700 font-semibold">Select category:</strong> With this tool, the agent selected one of the 34 topics created in the previous step and was then given the descriptions for each page in that category.</li>
              <li className="mb-2"><strong className="text-slate-700 font-semibold">Load Page:</strong> After viewing the list of pages, the agent provides a list of unique page IDs it would like to view. The pages are fetched and processed into markdown using the turndown package, which lowers the token count while maintaining document structure.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-3xl font-semibold text-slate-600 mt-10 mb-4 border-b-2 border-gray-100 pb-2">
              Cost
            </h2>
            <p className="mb-6 text-gray-600">This process took an afternoon and produced a useful chatbot with quick responses at a very reasonable cost.</p>

            <p className="mb-6 text-gray-600">For example: <em className="text-gray-500 italic">"How can I integrate Glean search into a React component?"</em></p>

            <div className="my-6 overflow-x-auto">
              <table className="w-full border-collapse bg-gray-50 rounded-lg overflow-hidden">
                <thead>
                  <tr>
                    <th className="bg-gray-100 px-4 py-3 text-left font-semibold text-gray-600 border-b border-gray-200">Category</th>
                    <th className="bg-gray-100 px-4 py-3 text-left font-semibold text-gray-600 border-b border-gray-200">Token Count</th>
                    <th className="bg-gray-100 px-4 py-3 text-left font-semibold text-gray-600 border-b border-gray-200">Price (per 1M)</th>
                    <th className="bg-gray-100 px-4 py-3 text-left font-semibold text-gray-600 border-b border-gray-200">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-gray-600 border-b border-gray-200">Input Tokens</td>
                    <td className="px-4 py-3 text-gray-600 border-b border-gray-200">7,955</td>
                    <td className="px-4 py-3 text-gray-600 border-b border-gray-200">$0.20</td>
                    <td className="px-4 py-3 text-gray-600 border-b border-gray-200">$0.001591</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-600 border-b border-gray-200">Output Tokens</td>
                    <td className="px-4 py-3 text-gray-600 border-b border-gray-200">2,340</td>
                    <td className="px-4 py-3 text-gray-600 border-b border-gray-200">$0.50</td>
                    <td className="px-4 py-3 text-gray-600 border-b border-gray-200">$0.001170</td>
                  </tr>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-4 py-3 text-gray-700"><strong>Total</strong></td>
                    <td className="px-4 py-3 text-gray-700"><strong>10,295</strong></td>
                    <td className="px-4 py-3 text-gray-700"></td>
                    <td className="px-4 py-3 text-gray-700"><strong>$0.002761</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mb-6 text-gray-600">From prompt to complete response with multiple React examples took 19 seconds.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-3xl font-semibold text-slate-600 mt-10 mb-4 border-b-2 border-gray-100 pb-2">
              Next steps
            </h2>
            <p className="mb-6 text-gray-600">
              Documentation with too much content becomes difficult to use, but chatbots with retrieval can work
              with information sets many times larger. With a team dedicated to adding troubleshooting content
              based on real customer tech support calls, this tool could become even more useful.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-3xl font-semibold text-slate-600 mt-10 mb-4 border-b-2 border-gray-100 pb-2">
              Conclusion
            </h2>
            <p className="mb-6 text-gray-600">
              With continued advancement in LLM cost and capability, chat interfaces are becoming the default
              experience for information retrieval. A well-designed onboarding and tech support bot can drive
              customer adoption and retention for minimal cost in both developer time and API costs.
              Try out the example discussed here.
            </p>
          </section>
        </div>
      </article>
    </div>
  )
}

export default BlogPage