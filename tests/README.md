# COI regression tests

Run with Node.js:

```
node tests/coi-engine.test.js
```

The suite checks the kinship engine against known pedigree relationships:
- unrelated individuals: 0%
- parent/offspring: 25%
- full siblings: 25%
- half siblings: 12.5%
- grandparent/grandchild: 12.5%
- first cousins: 6.25%
- double first cousins: 12.5%
- offspring sharing an inbred ancestor: 12.5%

These are **kinship coefficients between the two prospective parents**, which are equal to the expected Wright inbreeding coefficient of their offspring when the pedigree is complete and the relationship is represented correctly.
