# Atlas CMMS Frontend

This is the frontend of the web application developed with React. You can see more explanations in [Purpose.pdf](Purpose.pdf).
We would be very happy to have new contributors join us.
And please star the repo.


**Screenshot**:
![](https://i.ibb.co/7tGYCtv/Screenshot-502.png)

## Usage

```bash
npm i
set REACT_APP_API_URL=http://localhost:8080
npm start
```

### Experimental Supabase core

The Supabase interface is an independently selectable, limited core for
authentication, organizations, assets, and work orders. It does not yet
replace the complete Atlas feature set. To build or run it, set these
variables before starting the frontend:

```text
REACT_APP_CMMS_BACKEND=supabase
REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

Use only a publishable or anon key in browser configuration; never use a
service-role or secret key. Configure Supabase Auth's site URL and allowed
redirects for the deployed site. The database foundation and its access tests
are in `../supabase/`; the migration intentionally leaves authenticated
Data API schema access disabled until the integration is ready for rollout.

## Getting help

If you have questions, concerns, bug reports, etc, please file an issue in this repository's Issue Tracker or send an email at ibracool99@gmail.com.

## Getting involved

You can contribute in different ways. Sending feedback on features, fixing certain bugs, implementing new features, etc.
Instructions on _how_ to contribute can be found in [CONTRIBUTING](CONTRIBUTING.md).

