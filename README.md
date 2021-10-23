# Gsub 

This tool retrieves SSL/TLS certificate reports information from the [Google Transparency Report](https://transparencyreport.google.com/https/certificates) for a given domain.

Then it does a DNS resolution and HTTP GET request for filtering and information purposes.

It also performs a recursive domain discovery with a configurable depth level.

The final report is sent to *stdout* and the progression to *stderr*.

## Quick start

```
docker run --rm hessman/gsub -h

Usage: gsub -t domain.tld -d google.com google.fr -o json > report.json

Tool to retrieve SSL/TLS certificate reports information from the Google Transparency Report for a given domain.

Options:
  -v, --version                output the current version
  -t, --target [domain]        set the target domain
  -l, --depth-level <level>    set the depth level for the recursive domain discovery (default: "0")
  -o, --output-format          set the format for the report sent to stdout (choices: "csv", "html", "json", default: "html")
  -r, --only-resolved          only output resolved domain
  -d, --deny-list [domain...]  set the deny list for domain
  -h, --help                   display help for command
```