# Security policy

Please report security concerns privately through the repository owner's GitHub profile rather than opening a public issue containing exploit details or sensitive files:

https://github.com/l0ee

This application processes selected files with browser APIs and does not include a file-upload backend. A deployed site's hosting provider may still receive ordinary web-request metadata when serving the application and its assets.

The interface currently loads web fonts from Google Fonts. Selected files are not sent to Google Fonts or to an application upload service, but users requiring a fully self-contained deployment should self-host the fonts and update the content-security policy accordingly.
