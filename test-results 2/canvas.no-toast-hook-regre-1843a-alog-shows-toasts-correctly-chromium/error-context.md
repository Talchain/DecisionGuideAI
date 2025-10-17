# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: ROUTE=/canvas • COMMIT=dev • MODE=RF
  - generic [ref=e7]:
    - generic [ref=e8]:
      - img [ref=e10]
      - generic [ref=e12]:
        - heading "Something went wrong" [level=2] [ref=e13]
        - paragraph [ref=e14]: The canvas encountered an unexpected error
    - paragraph [ref=e16]: require is not defined
    - generic [ref=e17]:
      - button "Reload Editor" [ref=e18] [cursor=pointer]:
        - img [ref=e19]
        - text: Reload Editor
      - button "Copy Current State JSON" [ref=e21] [cursor=pointer]:
        - img [ref=e22]
        - text: Copy Current State JSON
      - button "Report Issue" [ref=e24] [cursor=pointer]:
        - img [ref=e25]
        - text: Report Issue
    - paragraph [ref=e27]: Your work is auto-saved. Reloading will restore the last snapshot.
```